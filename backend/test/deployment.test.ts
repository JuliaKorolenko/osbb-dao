import { expect } from "chai";
import { type DaoFixture, deployFixture } from "./helpers/fixtures.js";

describe("OSBB_DAO - Deployment", function () {
  let ctx: DaoFixture;

  beforeEach(async function () {
    ctx = await deployFixture();
  });

  it("Should set the correct owner", async function () {
    const ADMIN_ROLE = await ctx.osbbDAO.ADMIN_ROLE();
    expect(await ctx.osbbDAO.hasRole(ADMIN_ROLE, await ctx.owner.getAddress()))
      .to.be.true;
  });

  it("Should deploy governance token", async function () {
    expect(await ctx.governanceToken.getAddress()).to.be.properAddress;
    expect(await ctx.governanceToken.name()).to.equal("OSBB Voting Token");
    expect(await ctx.governanceToken.symbol()).to.equal("OSBBGT");
  });

  it("Should initialize correctly", async function () {
    expect(await ctx.osbbDAO.getBalance()).to.equal(0n);
    expect(await ctx.osbbDAO.getResidentCount()).to.equal(0);
    expect(await ctx.osbbDAO.totalArea()).to.equal(0);
  });
});
