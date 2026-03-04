import { expect } from "chai";
import { ethers, type DaoFixture, deployFixture } from "./helpers/fixtures.js";
import { AREA_1, AREA_2, AREA_3, TOKENS_PER_SQM } from "./helpers/constants.js";
import { registerResidents } from "./helpers/actions.js";

describe("OSBB_DAO - Residents", function () {
  let ctx: DaoFixture;

  beforeEach(async function () {
    ctx = await deployFixture();
  });

  describe("Resident Registration", function () {
    it("Should register residents correctly", async function () {
      const residentAddress1 = await ctx.member1.getAddress();

      const residentArgs = [
        await ctx.member1.getAddress(),
        AREA_1,
        AREA_1 * TOKENS_PER_SQM,
      ];

      await expect(ctx.osbbDAO.registerResident(residentAddress1, AREA_1))
        .to.emit(ctx.osbbDAO, "ResidentRegistered")
        .withArgs(...residentArgs);

      const residentInfo = await ctx.osbbDAO.getResidentInfo(residentAddress1);

      expect(residentInfo.apartmentArea).to.equal(AREA_1);
      expect(residentInfo.votingPower).to.equal(AREA_1 * TOKENS_PER_SQM);
      expect(residentInfo.isActive).to.be.true;

      expect(await ctx.osbbDAO.getResidentCount()).to.equal(1);
      expect(await ctx.osbbDAO.totalArea()).to.equal(AREA_1);
    });

    it("Should mint governance tokens to resident", async function () {
      await registerResidents(ctx.osbbDAO, [
        { signer: ctx.member1, area: AREA_1 },
      ]);

      const expectedTokens = AREA_1 * TOKENS_PER_SQM;

      expect(
        await ctx.governanceToken.balanceOf(await ctx.member1.getAddress()),
      ).to.equal(expectedTokens);
    });

    it("Should register multiple residents", async function () {
      const totalArea = AREA_1 + AREA_2 + AREA_3;

      await registerResidents(ctx.osbbDAO, [
        { signer: ctx.member1, area: AREA_1 },
        { signer: ctx.member2, area: AREA_2 },
        { signer: ctx.member3, area: AREA_3 },
      ]);

      expect(await ctx.osbbDAO.getResidentCount()).to.equal(3);
      expect(await ctx.osbbDAO.totalArea()).to.equal(totalArea);
    });

    it("Should revert if non-admin tries to register resident", async function () {
      await expect(
        ctx.osbbDAO
          .connect(ctx.member1)
          .registerResident(await ctx.member2.getAddress(), AREA_2),
      ).to.be.revertedWithCustomError(
        ctx.osbbDAO,
        "AccessControlUnauthorizedAccount",
      );
    });

    it("Should revert if resident already registered", async function () {
      await registerResidents(ctx.osbbDAO, [
        { signer: ctx.member1, area: AREA_1 },
      ]);

      await expect(
        registerResidents(ctx.osbbDAO, [{ signer: ctx.member1, area: AREA_1 }]),
      ).to.be.revertedWith("Meshkanets vzhe zareyestrovanyy");
    });

    it("Should revert with zero apartment area", async function () {
      await expect(
        registerResidents(ctx.osbbDAO, [{ signer: ctx.member1, area: 0 }]),
      ).to.be.revertedWith("Ploshcha kvartiry maye buty bilshe 0");
    });

    it("Should revert with zero address", async function () {
      await expect(
        ctx.osbbDAO.registerResident(ethers.ZeroAddress, AREA_1),
      ).to.be.revertedWith("Nevirna adresa");
    });
  });

  describe("Resident Removal", function () {
    beforeEach(async function () {
      await registerResidents(ctx.osbbDAO, [
        { signer: ctx.member1, area: AREA_1 },
        { signer: ctx.member2, area: AREA_2 },
      ]);
    });

    it("Should remove a resident correctly", async function () {
      const votingPower = AREA_1 * TOKENS_PER_SQM;
      const residentAddress1 = await ctx.member1.getAddress();

      await expect(ctx.osbbDAO.removeResident(residentAddress1))
        .to.emit(ctx.osbbDAO, "ResidentRemoved")
        .withArgs(residentAddress1, votingPower);

      const residentInfo = await ctx.osbbDAO.getResidentInfo(residentAddress1);

      expect(residentInfo.isActive).to.be.false;
      expect(residentInfo.votingPower).to.equal(0);

      expect(await ctx.osbbDAO.totalArea()).to.equal(AREA_2);
      expect(await ctx.osbbDAO.getResidentCount()).to.equal(1);
    });

    it("Should burn governance tokens when removing resident", async function () {
      const residentAddress1 = await ctx.member1.getAddress();

      await ctx.osbbDAO.removeResident(residentAddress1);
      expect(await ctx.governanceToken.balanceOf(residentAddress1)).to.equal(
        0n,
      );
    });

    it("Should revert when removing non-existent resident", async function () {
      await expect(
        ctx.osbbDAO.removeResident(await ctx.member3.getAddress()),
      ).to.be.revertedWith("Meshkanets ne zareyestrovanyy");
    });

    it("Should revert if non-admin tries to remove resident", async function () {
      await expect(
        ctx.osbbDAO
          .connect(ctx.member1)
          .removeResident(await ctx.member2.getAddress()),
      ).to.be.revertedWithCustomError(
        ctx.osbbDAO,
        "AccessControlUnauthorizedAccount",
      );
    });
  });
});
