import { expect } from "chai";
import {
  type DaoFixture,
  deployWithProposalQueueFixture,
} from "../helpers/fixtures.js";
import { MIN_VOTING_DURATION, TIMELOCK_DELAY } from "../helpers/constants.js";
import {
  castVotes,
  createProposal,
  ethers,
  increaseTime,
  mine,
} from "../helpers/actions.js";

describe("OSBB_DAO - Proposal Execute", function () {
  let ctx: DaoFixture;
  let proposalId: bigint;

  beforeEach(async function () {
    ({ ctx, proposalId } = await deployWithProposalQueueFixture());

    await ctx.osbbDAO.queueProposal(proposalId);
  });

  it("Should execute proposal after timelock", async function () {
    await increaseTime(TIMELOCK_DELAY);

    const executorBalanceBefore = await ethers.provider.getBalance(
      await ctx.executor.getAddress(),
    );
    const proposalAmount = ethers.parseEther("1");

    await expect(ctx.osbbDAO.executeProposal(proposalId))
      .to.emit(ctx.osbbDAO, "ProposalExecuted")
      .withArgs(proposalId, await ctx.executor.getAddress(), proposalAmount);

    const executorBalanceAfter = await ethers.provider.getBalance(
      await ctx.executor.getAddress(),
    );

    expect(executorBalanceAfter).to.equal(
      executorBalanceBefore + proposalAmount,
    );

    const proposal = await ctx.osbbDAO.getProposal(proposalId);
    expect(proposal.executed).to.be.true;
  });

  it("Should revert executing proposal before timelock", async function () {
    await expect(ctx.osbbDAO.executeProposal(proposalId)).to.be.revertedWith(
      "Timelock not expired",
    );
  });

  it("Should revert executing without queue", async function () {
    await createProposal(ctx.osbbDAO, ctx.member1, {
      executor: await ctx.executor.getAddress(),
      description: "Not queued Proposal",
    });

    const proposalId = await ctx.osbbDAO.getProposalCount();

    await mine();

    await castVotes(ctx.osbbDAO, proposalId, [
      { signer: ctx.member1, support: true },
      { signer: ctx.member2, support: true },
      { signer: ctx.member3, support: true },
    ]);

    await increaseTime(MIN_VOTING_DURATION + TIMELOCK_DELAY);

    await expect(ctx.osbbDAO.executeProposal(proposalId)).to.be.revertedWith(
      "Proposal not queued",
    );
  });

  it("Should revert executing twice", async function () {
    await increaseTime(TIMELOCK_DELAY);

    await ctx.osbbDAO.executeProposal(proposalId);

    await expect(ctx.osbbDAO.executeProposal(proposalId)).to.be.revertedWith(
      "Already executed",
    );
  });

  it("Should revert if insufficient funds", async function () {
    await createProposal(ctx.osbbDAO, ctx.member1, {
      executor: await ctx.executor.getAddress(),
      description: "Large Proposal",
      amount: ethers.parseEther("10"),
    });

    const largeProposalId = await ctx.osbbDAO.getProposalCount();

    await mine();

    await castVotes(ctx.osbbDAO, largeProposalId, [
      { signer: ctx.member1, support: true },
      { signer: ctx.member2, support: true },
      { signer: ctx.member3, support: true },
    ]);

    await increaseTime(MIN_VOTING_DURATION);

    await ctx.osbbDAO.queueProposal(largeProposalId);

    await increaseTime(TIMELOCK_DELAY);

    await ctx.osbbDAO.executeProposal(proposalId); // execute first proposal to reduce funds

    await expect(
      ctx.osbbDAO.executeProposal(largeProposalId),
    ).to.be.revertedWith("Not enough funds");
  });
});
