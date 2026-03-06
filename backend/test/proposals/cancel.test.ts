import { expect } from "chai";
import {
  type DaoFixture,
  deployWithProposalFixture,
} from "../helpers/fixtures.js";
import { MIN_VOTING_DURATION } from "../helpers/constants.js";
import { castVotes, increaseTime, mine } from "../helpers/actions.js";

describe("OSBB_DAO - Proposal Cancel", function () {
  let ctx: DaoFixture;
  let proposalId: bigint;

  beforeEach(async function () {
    ({ ctx, proposalId } = await deployWithProposalFixture());
  });

  it("Should allow admin to cancel active proposal", async function () {
    await expect(ctx.osbbDAO.cancelProposal(proposalId))
      .to.emit(ctx.osbbDAO, "ProposalCanceled")
      .withArgs(proposalId);

    const proposal = await ctx.osbbDAO.getProposal(proposalId);
    expect(proposal.canceled).to.be.true;
  });

  it("Should allow canceling failed proposal after voting", async function () {
    await castVotes(ctx.osbbDAO, proposalId, [
      { signer: ctx.member1, support: false },
    ]);

    await increaseTime(MIN_VOTING_DURATION);

    await expect(ctx.osbbDAO.cancelProposal(proposalId))
      .to.emit(ctx.osbbDAO, "ProposalCanceled")
      .withArgs(proposalId);
  });

  it("Should prevent canceling passed proposal after voting", async function () {
    await castVotes(ctx.osbbDAO, proposalId, [
      { signer: ctx.member1, support: true },
      { signer: ctx.member2, support: true },
      { signer: ctx.member3, support: true },
    ]);

    await increaseTime(MIN_VOTING_DURATION);

    await expect(ctx.osbbDAO.cancelProposal(proposalId)).to.be.revertedWith(
      "Ne mozhna skasuvaty odobrenu propozytsiyu",
    );
  });

  it("Should prevent canceling queued proposal", async function () {
    await castVotes(ctx.osbbDAO, proposalId, [
      { signer: ctx.member1, support: true },
      { signer: ctx.member2, support: true },
      { signer: ctx.member3, support: true },
    ]);

    await increaseTime(MIN_VOTING_DURATION);

    await ctx.osbbDAO.queueProposal(proposalId);

    await expect(ctx.osbbDAO.cancelProposal(proposalId)).to.be.revertedWith(
      "Already queued",
    );
  });

  it("Should revert if non-admin tries to cancel", async function () {
    await expect(
      ctx.osbbDAO.connect(ctx.member1).cancelProposal(proposalId),
    ).to.be.revertedWithCustomError(
      ctx.osbbDAO,
      "AccessControlUnauthorizedAccount",
    );
  });

  it("Should revert canceling already canceled proposal", async function () {
    await ctx.osbbDAO.cancelProposal(proposalId);

    await expect(ctx.osbbDAO.cancelProposal(proposalId)).to.be.revertedWith(
      "Propozyciya vzhe skasovana",
    );
  });

  it("Should prevent voting on canceled proposal", async function () {
    await ctx.osbbDAO.cancelProposal(proposalId);

    await mine();

    await expect(
      castVotes(ctx.osbbDAO, proposalId, [
        { signer: ctx.member1, support: true },
      ]),
    ).to.be.revertedWith("Propozyciya skasovana");
  });
});
