import { expect } from "chai";
import { type DaoFixture, deployFixture } from "./helpers/fixtures.js";
import { AREA_1, AREA_2, AREA_3, TOKENS_PER_SQM } from "./helpers/constants.js";
import { mine, setupResidents } from "./helpers/actions.js";

describe("OSBB_DAO - Tokens", function () {
  let ctx: DaoFixture;

  beforeEach(async function () {
    ctx = await deployFixture();
    await setupResidents(ctx.osbbDAO, ctx.governanceToken, [
      { signer: ctx.member1, area: AREA_1 },
      { signer: ctx.member2, area: AREA_2 },
    ]);
  });

  describe("OSBB_DAO - Non-transferable Token", function () {
    it("Should prevent token transfers between residents", async function () {
      const transferAmount = 1000n;

      await expect(
        ctx.governanceToken
          .connect(ctx.member1)
          .transfer(await ctx.member2.getAddress(), transferAmount),
      ).to.be.revertedWith(
        "Tokeny ne mozhna perekaduvaty! Vony pryviazani do kvartiry",
      );
    });

    it("Should prevent token transfers to any address", async function () {
      const transferAmount = 1000n;

      await expect(
        ctx.governanceToken
          .connect(ctx.member1)
          .transfer(await ctx.executor.getAddress(), transferAmount),
      ).to.be.revertedWith(
        "Tokeny ne mozhna perekaduvaty! Vony pryviazani do kvartiry",
      );
    });

    it("Should allow minting tokens to residents", async function () {
      await setupResidents(ctx.osbbDAO, ctx.governanceToken, [
        { signer: ctx.member3, area: AREA_3 },
      ]);

      expect(
        await ctx.governanceToken.balanceOf(await ctx.member3.getAddress()),
      ).to.equal(AREA_3 * TOKENS_PER_SQM);
    });

    it("Should allow burning", async function () {
      const balanceBefore = await ctx.governanceToken.balanceOf(
        await ctx.member1.getAddress(),
      );
      expect(balanceBefore).to.be.gt(0n);

      await ctx.osbbDAO.removeResident(await ctx.member1.getAddress());

      const balanceAfter = await ctx.governanceToken.balanceOf(
        await ctx.member1.getAddress(),
      );
      expect(balanceAfter).to.equal(0n);
    });
  });

  describe("OSBB_DAO - Token Delegation", function () {
    it("Delegated votes should be reflected in voting power snapshot", async function () {
      // member1 delegates to member2
      await ctx.governanceToken.connect(ctx.member1).delegate(ctx.member2);
      await mine();

      const votes = await ctx.governanceToken.getVotes(
        await ctx.member2.getAddress(),
      );
      expect(votes).to.equal((AREA_1 + AREA_2) * TOKENS_PER_SQM);
    });
  });
});
