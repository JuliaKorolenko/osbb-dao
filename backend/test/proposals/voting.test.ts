import { expect } from "chai";
import {
  type DaoFixture,
  deployWithProposalFixture,
} from "../helpers/fixtures.js";
import {
  AREA_1,
  AREA_2,
  AREA_3,
  MIN_VOTING_DURATION,
  TOKENS_PER_SQM,
} from "../helpers/constants.js";
import { castVotes, increaseTime } from "../helpers/actions.js";

describe("OSBB_DAO - Proposal Voting", function () {
  let ctx: DaoFixture;
  let proposalId: bigint;

  beforeEach(async function () {
    ({ ctx, proposalId } = await deployWithProposalFixture());
  });

  describe("Vote casting", function () {
    it("Should allow resident to vote", async function () {
      const voteWeight = AREA_1 * TOKENS_PER_SQM;

      await expect(ctx.osbbDAO.connect(ctx.member1).castVote(proposalId, true))
        .to.emit(ctx.osbbDAO, "VoteCast")
        .withArgs(await ctx.member1.getAddress(), proposalId, true, voteWeight);

      const receipt = await ctx.osbbDAO.getVoteReceipt(
        proposalId,
        await ctx.member1.getAddress(),
      );

      expect(receipt.hasVoted).to.be.true;
      expect(receipt.support).to.be.true;
      expect(receipt.votes).to.equal(voteWeight);
    });

    it("Should count votes correctly", async function () {
      const expectedForVotes = (AREA_1 + AREA_3) * TOKENS_PER_SQM;
      const expectedAgainstVotes = AREA_2 * TOKENS_PER_SQM;

      await castVotes(ctx.osbbDAO, proposalId, [
        { signer: ctx.member1, support: true },
        { signer: ctx.member2, support: false },
        { signer: ctx.member3, support: true },
      ]);

      const proposal = await ctx.osbbDAO.getProposal(proposalId);

      expect(proposal.votesFor).to.equal(expectedForVotes);
      expect(proposal.votesAgainst).to.equal(expectedAgainstVotes);
    });

    it("Should revert when voting twice", async function () {
      await castVotes(ctx.osbbDAO, proposalId, [
        { signer: ctx.member1, support: true },
      ]);

      await expect(
        castVotes(ctx.osbbDAO, proposalId, [
          { signer: ctx.member1, support: false },
        ]),
      ).to.be.revertedWith("Vy vzhe proholosuvaly");
    });

    it("Should revert if non-resident votes", async function () {
      await expect(
        castVotes(ctx.osbbDAO, proposalId, [
          { signer: ctx.executor, support: false },
        ]),
      ).to.be.revertedWith("U vas nemaye prava holosu");
    });

    it("Should revert if voting after deadline", async function () {
      const deadlineIncreased = Number(MIN_VOTING_DURATION) + 3600;

      await increaseTime(deadlineIncreased);

      await expect(
        castVotes(ctx.osbbDAO, proposalId, [
          { signer: ctx.member1, support: true },
        ]),
      ).to.be.revertedWith("Termin holosuvannya zakinchyvsya");
    });

    it("Should revert voting on non-existent proposal", async function () {
      await expect(
        ctx.osbbDAO.connect(ctx.member1).castVote(999, true),
      ).to.be.revertedWith("Propozyciya ne isnuye");
    });
  });

  describe("Voting result", function () {
    it("Should pass with quorum and approval (all votes yes)", async function () {
      // Need 80% of 22500 = 18000 tokens
      // resident2 (7500) + resident3 (10000) = 17500 < 18000
      // All three needed for quorum
      await castVotes(ctx.osbbDAO, proposalId, [
        { signer: ctx.member1, support: true },
        { signer: ctx.member2, support: true },
        { signer: ctx.member3, support: true },
      ]);

      await increaseTime(MIN_VOTING_DURATION);

      const isSuccessful = await ctx.osbbDAO.proposalSucceeded(proposalId);
      expect(isSuccessful).to.be.true;
    });

    it("Should pass with quorum and approval (majority votes yes)", async function () {
      await castVotes(ctx.osbbDAO, proposalId, [
        { signer: ctx.member1, support: true },
        { signer: ctx.member2, support: false },
        { signer: ctx.member3, support: true },
      ]);

      await increaseTime(MIN_VOTING_DURATION);

      const isSuccessful = await ctx.osbbDAO.proposalSucceeded(proposalId);
      expect(isSuccessful).to.be.true;
    });

    it("Should fail without quorum", async function () {
      // Only one member voted, but quorum requires 80% participation (18000 tokens)
      // member1 has 5000 tokens, so 5000 < 18000

      await castVotes(ctx.osbbDAO, proposalId, [
        { signer: ctx.member1, support: true },
      ]);

      await increaseTime(MIN_VOTING_DURATION);

      const isSuccessful = await ctx.osbbDAO.proposalSucceeded(proposalId);
      expect(isSuccessful).to.be.false;
    });

    it("Should fail with quorum but not enough approval", async function () {
      // 100% participation, 0% approval

      await castVotes(ctx.osbbDAO, proposalId, [
        { signer: ctx.member1, support: false },
        { signer: ctx.member2, support: false },
        { signer: ctx.member3, support: false },
      ]);

      await increaseTime(MIN_VOTING_DURATION);

      const isSuccessful = await ctx.osbbDAO.proposalSucceeded(proposalId);
      expect(isSuccessful).to.be.false;
    });

    it("Should fail with no votes", async function () {
      await increaseTime(MIN_VOTING_DURATION);

      const isSuccessful = await ctx.osbbDAO.proposalSucceeded(proposalId);
      expect(isSuccessful).to.be.false;
    });
  });
});
