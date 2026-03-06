import { expect } from "chai";
import { type DaoFixture, deployFixture, ethers } from "./helpers/fixtures.js";
import { increaseTime } from "./helpers/actions.js";
import { TIMELOCK_DELAY } from "./helpers/constants.js";

describe("OSBB_DAO - Fund Deposits", function () {
  let ctx: DaoFixture;

  beforeEach(async function () {
    ctx = await deployFixture();
  });

  it("Should accept deposits via depositFunds correctly", async function () {
    const depositAmount = ethers.parseEther("0.5");

    await expect(ctx.osbbDAO.depositFunds({ value: depositAmount }))
      .to.emit(ctx.osbbDAO, "FundsDeposited")
      .withArgs(await ctx.owner.getAddress(), depositAmount);

    expect(await ctx.osbbDAO.getBalance()).to.equal(depositAmount);
  });

  it("Should accumulate funds correctly", async function () {
    const depositAmount1 = ethers.parseEther("1.0");
    const depositAmount2 = ethers.parseEther("0.5");

    await ctx.osbbDAO.depositFunds({ value: depositAmount1 });
    await ctx.osbbDAO.depositFunds({ value: depositAmount2 });

    expect(await ctx.osbbDAO.getBalance()).to.equal(
      depositAmount1 + depositAmount2,
    );
  });

  it("Should revert with zero deposit", async function () {
    await expect(ctx.osbbDAO.depositFunds({ value: 0n })).to.be.revertedWith(
      "Suma maye buty bilshe 0",
    );
  });

  it("Should accept deposits via direct ETH transfer", async function () {
    const depositAmount = ethers.parseEther("0.75");

    await expect(
      ctx.owner.sendTransaction({
        to: await ctx.osbbDAO.getAddress(),
        value: depositAmount,
      }),
    )
      .to.emit(ctx.osbbDAO, "FundsDeposited")
      .withArgs(await ctx.owner.getAddress(), depositAmount);

    expect(await ctx.osbbDAO.getBalance()).to.equal(depositAmount);
  });
});
