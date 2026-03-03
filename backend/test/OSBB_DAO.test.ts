import { expect } from "chai";
import { network } from "hardhat";
import { type Signer } from "ethers";
// import { registerResidents } from "./helpers/actions.js";
import { AREA_1, AREA_2, AREA_3, TOKENS_PER_SQM } from "./helpers/constants.js";
import { registerResidents } from "./helpers/actions.js";

const { ethers } = await network.connect();

// const AREA_1 = 50n; // 50 m²
// const AREA_2 = 75n; // 75 m²
// const AREA_3 = 100n; // 100 m²
// const TOKENS_PER_SQM = 100n; // 0.1 ETH per m²
// const MIN_VOTING_DURATION = 3n * 24n * 60n * 60n; // 3 days in seconds
// const TIMELOCK_DELAY = 2n * 24n * 60n * 60n; // 2 days in seconds

describe.only("OSBB_DAO", async function () {
  let osbbDAO: any;
  let governanceToken: any;
  let owner: Signer;
  let member1: Signer;
  let member2: Signer;
  let member3: Signer;
  let executor: Signer;

  beforeEach(async function () {
    // Deploy a fresh instance of the contract before each test
    [owner, member1, member2, member3, executor] = await ethers.getSigners();

    const OSSB_DAOFactory = await ethers.getContractFactory("OSBB_DAO");
    osbbDAO = await OSSB_DAOFactory.deploy();
    await osbbDAO.waitForDeployment();

    const tokenAddress = await osbbDAO.governanceToken();
    governanceToken = await ethers.getContractAt("OSBB_Token", tokenAddress);
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const ADMIN_ROLE = await osbbDAO.ADMIN_ROLE();
      expect(await osbbDAO.hasRole(ADMIN_ROLE, await owner.getAddress())).to.be
        .true;
    });

    it("Should deploy governance token", async function () {
      expect(await governanceToken.getAddress()).to.be.properAddress;
      expect(await governanceToken.name()).to.equal("OSBB Voting Token");
      expect(await governanceToken.symbol()).to.equal("OSBBGT");
    });

    it("Should initialize correctly", async function () {
      expect(await osbbDAO.getBalance()).to.equal(0n);
      expect(await osbbDAO.getResidentCount()).to.equal(0);
      expect(await osbbDAO.totalArea()).to.equal(0);
    });
  });

  describe.only("Resident Registration", function () {
    it("Should register residents correctly", async function () {
      const residentAddress1 = await member1.getAddress();

      const residentArgs = [
        await member1.getAddress(),
        AREA_1,
        AREA_1 * TOKENS_PER_SQM,
      ];

      await expect(osbbDAO.registerResident(residentAddress1, AREA_1))
        .to.emit(osbbDAO, "ResidentRegistered")
        .withArgs(...residentArgs);

      const residentInfo = await osbbDAO.getResidentInfo(residentAddress1);

      expect(residentInfo.apartmentArea).to.equal(AREA_1);
      expect(residentInfo.votingPower).to.equal(AREA_1 * TOKENS_PER_SQM);
      expect(residentInfo.isActive).to.be.true;

      expect(await osbbDAO.getResidentCount()).to.equal(1);
      expect(await osbbDAO.totalArea()).to.equal(AREA_1);
    });

    it("Should mint governance tokens to resident", async function () {
      await registerResidents(osbbDAO, [{ signer: member1, area: AREA_1 }]);

      const expectedTokens = AREA_1 * TOKENS_PER_SQM;

      expect(
        await governanceToken.balanceOf(await member1.getAddress()),
      ).to.equal(expectedTokens);
    });

    it("Should register multiple residents", async function () {
      const totalArea = AREA_1 + AREA_2 + AREA_3;

      await registerResidents(osbbDAO, [
        { signer: member1, area: AREA_1 },
        { signer: member2, area: AREA_2 },
        { signer: member3, area: AREA_3 },
      ]);

      expect(await osbbDAO.getResidentCount()).to.equal(3);
      expect(await osbbDAO.totalArea()).to.equal(totalArea);
    });
  });
});
