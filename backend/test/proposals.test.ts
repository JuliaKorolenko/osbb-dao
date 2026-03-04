import { expect } from "chai";
import { type DaoFixture, deployFixture, ethers } from "./helpers/fixtures.js";
import { AREA_1, MIN_VOTING_DURATION } from "./helpers/constants.js";
import { createProposal } from "./helpers/actions.js";

describe("OSBB_DAO - Proposal", function () {
  let ctx: DaoFixture;
  let executor: string;

  beforeEach(async function () {
    ctx = await deployFixture();
    executor = await ctx.executor.getAddress();
  });

  describe("Proposal Creation", function () {
    beforeEach(async function () {
      await ctx.osbbDAO.registerResident(
        await ctx.member1.getAddress(),
        AREA_1,
      );
      await ctx.osbbDAO.depositFunds({ value: ethers.parseEther("10") });
    });

    it("Should create a proposal correctly", async function () {
      const proposalArgs = {
        description: "Fix the roof",
        amount: ethers.parseEther("2"),
        executor,
        duration: MIN_VOTING_DURATION,
      };

      const tx = await createProposal(ctx.osbbDAO, ctx.member1, proposalArgs);

      await expect(tx).to.emit(ctx.osbbDAO, "ProposalCreated");
      const proposal = await ctx.osbbDAO.proposals(1);

      expect(proposal.description).to.equal(proposalArgs.description);
      expect(proposal.amount).to.equal(proposalArgs.amount);
      expect(proposal.executor).to.equal(proposalArgs.executor);
      expect(proposal.executed).to.be.false;
      expect(proposal.canceled).to.be.false;
    });

    it("Should increment proposal counter", async function () {
      const executorAddress = await ctx.executor.getAddress();

      await createProposal(ctx.osbbDAO, ctx.member1, {
        executor,
        description: "Proposal 1",
      });
      await createProposal(ctx.osbbDAO, ctx.member1, {
        executor,
        description: "Proposal 2",
      });

      expect(await ctx.osbbDAO.getProposalCount()).to.equal(2);
    });

    it("Should revert if non-resident tries to create proposal", async function () {
      await expect(
        createProposal(ctx.osbbDAO, ctx.member2, {
          executor,
          description: "Unauthorized Proposal",
        }),
      ).to.be.revertedWith("U vas nemaye prava stvoruvaty propozytsiyi");
    });

    it("Should revert with zero amount", async function () {
      await expect(
        createProposal(ctx.osbbDAO, ctx.member1, {
          executor,
          description: "Zero Amount Proposal",
          amount: ethers.parseEther("0"),
        }),
      ).to.be.revertedWith("Suma maye buty bilshe 0");
    });

    it("Should revert with amount exceeding balance", async function () {
      await expect(
        createProposal(ctx.osbbDAO, ctx.member1, {
          executor,
          description: "Excessive Amount Proposal",
          amount: ethers.parseEther("20"),
        }),
      ).to.be.revertedWith("Nedostatno koshtiv u fondi");
    });

    it("Should revert with invalid executor address", async function () {
      await expect(
        createProposal(ctx.osbbDAO, ctx.member1, {
          executor: ethers.ZeroAddress,
          description: "Invalid Executor Proposal",
        }),
      ).to.be.revertedWith("Nevirna adresa vykonavtsya");
    });

    it("Should revert with too short voting duration", async function () {
      await expect(
        createProposal(ctx.osbbDAO, ctx.member1, {
          executor,
          description: "Short Voting Duration Proposal",
          duration: MIN_VOTING_DURATION - 1n,
        }),
      ).to.be.revertedWith("Period holosuvannya zamalo");
    });

    it("Should revert with empty description", async function () {
      await expect(
        createProposal(ctx.osbbDAO, ctx.member1, {
          executor,
          description: "",
        }),
      ).to.be.revertedWith("Opys ne mozhe buty porozhnim");
    });
  });
});
