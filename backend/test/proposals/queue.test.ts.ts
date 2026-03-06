import { expect } from "chai";
import {
  type DaoFixture,
  deployWithProposalQueueFixture,
} from "../helpers/fixtures.js";
import { MIN_VOTING_DURATION } from "../helpers/constants.js";
import {
  castVotes,
  createProposal,
  increaseTime,
  mine,
} from "../helpers/actions.js";

describe("OSBB_DAO - Proposal Queue", function () {
  let ctx: DaoFixture;
  let proposalId: bigint;

  beforeEach(async function () {
    ({ ctx, proposalId } = await deployWithProposalQueueFixture());
  });

  it("Should queue a successful proposal", async function () {
    await expect(ctx.osbbDAO.queueProposal(proposalId)).to.emit(
      ctx.osbbDAO,
      "ProposalQueued",
    );

    const queueTime = await ctx.osbbDAO.queuedAt(proposalId);

    expect(queueTime).to.be.gt(0);
  });

  it("Should revert queueing before voting ends", async function () {
    await createProposal(ctx.osbbDAO, ctx.member1, {
      executor: await ctx.executor.getAddress(),
      description: "Short Voting Duration Proposal",
    });

    const proposalId = await ctx.osbbDAO.getProposalCount();

    await expect(ctx.osbbDAO.queueProposal(proposalId)).to.be.revertedWith(
      "Voting not finished",
    );
  });

  it("Should  revert queueing failed proposals", async function () {
    await createProposal(ctx.osbbDAO, ctx.member1, {
      executor: await ctx.executor.getAddress(),
      description: "Failed Proposal",
    });

    const proposalId = await ctx.osbbDAO.getProposalCount();

    await mine();

    await castVotes(ctx.osbbDAO, proposalId, [
      { signer: ctx.member1, support: false },
      { signer: ctx.member2, support: false },
      { signer: ctx.member3, support: false },
    ]);

    await increaseTime(MIN_VOTING_DURATION);

    await expect(ctx.osbbDAO.queueProposal(proposalId)).to.be.revertedWith(
      "Proposal not passed",
    );
  });

  it("Should revert queueing twice", async function () {
    await ctx.osbbDAO.queueProposal(proposalId);

    await expect(ctx.osbbDAO.queueProposal(proposalId)).to.be.revertedWith(
      "Already queued",
    );
  });
});
