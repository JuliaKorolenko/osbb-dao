import { expect } from 'chai';
import  { network } from 'hardhat';
import { type Signer } from 'ethers';

const { ethers } = await network.connect();

// describe("sanity", function () {
//   it("evm mine works", async function () {
//     const { ethers } = await network.connect();

//     await ethers.provider.send("evm_mine", []);
//   });
// });

describe.only('OSBB_DAO', function () {
  let osbbDAO: any;
  let governanceToken: any;
  let owner: Signer;
  let member1: Signer;
  let member2: Signer;
  let member3: Signer;
  let executor: Signer;

  const APPARTMENT_AREA_1 = 50n; // 50 m²
  const APPARTMENT_AREA_2 = 75n; // 75 m²
  const APPARTMENT_AREA_3 = 100n; // 100 m²
  const TOKENS_PER_SQM = 100n; // 0.1 ETH per m²
  const MIN_VOTING_DURATION = 3n * 24n * 60n * 60n; // 3 days in seconds
  const TIMELOCK_DELAY = 2n * 24n * 60n * 60n; // 2 days in seconds
  

  beforeEach(async function () {
    [owner, member1, member2, member3, executor] = await ethers.getSigners();

    const OSSB_DAOFactory = await ethers.getContractFactory('OSBB_DAO');
    osbbDAO = await OSSB_DAOFactory.deploy();
    await osbbDAO.waitForDeployment();

    const tokenAddress = await osbbDAO.governanceToken();
    governanceToken = await ethers.getContractAt('OSBB_Token', tokenAddress);

    // await ethers.provider.send("evm_increaseTime", [3600]);
    // await ethers.provider.send("evm_mine", []);

    
  });

  describe('Deployment', function () {
    it('Should set the correct owner', async function () {
      const ADMIN_ROLE = await osbbDAO.ADMIN_ROLE();
      expect(await osbbDAO.hasRole(ADMIN_ROLE, await owner.getAddress())).to.be.true;
    });
  
    it('Should deploy governance token', async function () {
      expect(await governanceToken.getAddress()).to.be.properAddress;
      expect(await governanceToken.name()).to.equal('OSBB Voting Token');
      expect(await governanceToken.symbol()).to.equal('OSBBGT');
    });
  
    it('Should initialize correctly', async function () {
      expect(await osbbDAO.getBalance()).to.equal(0n);
      expect(await osbbDAO.getResidentCount()).to.equal(0);
      expect(await osbbDAO.totalArea()).to.equal(0);
    });
  });

  describe('Resident Registration', function () {
    it('Should register residents correctly', async function () {

      const residentAddress1 = await member1.getAddress();

      const residentArgs = [
        await member1.getAddress(),
        APPARTMENT_AREA_1,
        APPARTMENT_AREA_1 * TOKENS_PER_SQM
      ];
      
      await expect(osbbDAO.registerResident(residentAddress1, APPARTMENT_AREA_1))
        .to.emit(osbbDAO, 'ResidentRegistered')
        .withArgs(...residentArgs);

      const residentInfo = await osbbDAO.getResidentInfo(residentAddress1);

      expect(residentInfo.apartmentArea).to.equal(APPARTMENT_AREA_1);
      expect(residentInfo.votingPower).to.equal(APPARTMENT_AREA_1 * TOKENS_PER_SQM);
      expect(residentInfo.isActive).to.be.true;

      expect(await osbbDAO.getResidentCount()).to.equal(1);
      expect(await osbbDAO.totalArea()).to.equal(APPARTMENT_AREA_1);
   });

   it('Should mint governance tokens to resident', async function () {
     await osbbDAO.registerResident(await member1.getAddress(), APPARTMENT_AREA_1);
     const expectedTokens = APPARTMENT_AREA_1 * TOKENS_PER_SQM;

     expect(await governanceToken.balanceOf(await member1.getAddress())).to.equal(expectedTokens);
   });

   it('Should register multiple residents', async function () {
      const totalArea = APPARTMENT_AREA_1 + APPARTMENT_AREA_2 + APPARTMENT_AREA_3;

      await osbbDAO.registerResident(await member1.getAddress(), APPARTMENT_AREA_1);
      await osbbDAO.registerResident(await member2.getAddress(), APPARTMENT_AREA_2);
      await osbbDAO.registerResident(await member3.getAddress(), APPARTMENT_AREA_3);

      expect(await osbbDAO.getResidentCount()).to.equal(3);
      expect(await osbbDAO.totalArea()).to.equal(totalArea);
    });

    it('Should revert if non-admin tries to register resident', async function () {      
      await expect(osbbDAO.connect(member1).registerResident(await member2.getAddress(), APPARTMENT_AREA_2))
        .to.be.revertedWithCustomError(osbbDAO, "AccessControlUnauthorizedAccount");
    });

    it('Should revert if resident already registered', async function () {
      await osbbDAO.registerResident(await member1.getAddress(), APPARTMENT_AREA_1);

      await expect(osbbDAO.registerResident(await member1.getAddress(), APPARTMENT_AREA_1))
        .to.be.revertedWith("Meshkanets vzhe zareyestrovanyy");
    });

    it('Should revert with zero apartment area', async function () {
      await expect(osbbDAO.registerResident(await member1.getAddress(), 0))
        .to.be.revertedWith("Ploshcha kvartiry maye buty bilshe 0")
    });

    it('Should revert with zero address', async function () {
      await expect(osbbDAO.registerResident(ethers.ZeroAddress, APPARTMENT_AREA_1))
        .to.be.revertedWith("Nevirna adresa")
    });
  });


  describe('Resident Removal', function () {
    console.log(">>> tests of removing resinents, coming soon...");
    
    // it('Should create proposals correctly', async function () {
    //   // Test logic goes here
    // });
  });


  describe('Fund Deposits', function () {
    console.log(">>> tests of deposits, coming soon...");
    // it('Should create proposals correctly', async function () {
    //   // Test logic goes here
    // });
  });

  describe('Proposal Creation', function () {
    console.log(">>> tests of proposals creation, coming soon...");
    // it('Should create proposals correctly', async function () {
    //   // Test logic goes here
    // });
  });

  describe('Voting', function () {
    console.log(">>> tests of voting, coming soon...");
    // it('Should create proposals correctly', async function () {
    //   // Test logic goes here
    // });
  });


  describe('Is proposal successful', function () {
    console.log(">>> tests of proposal successful, coming soon...");
    // it('Should create proposals correctly', async function () {
    //   // Test logic goes here
    // });
  });

  describe('Proposal Queue', function () {
    console.log(">>> tests of proposal queue, coming soon...");
    // it('Should create proposals correctly', async function () {
    //   // Test logic goes here
    // });
  });

  describe('Proposal Execution', function () {
    console.log(">>> tests of proposal execution, coming soon...");
    // it('Should create proposals correctly', async function () {
    //   // Test logic goes here
    // });
  });

  describe('Proposal Cancelation', function () {
    console.log(">>> tests of proposal cancelation, coming soon...");
    // it('Should create proposals correctly', async function () {
    //   // Test logic goes here
    // });
  });

  describe('Proposal Cancelation', function () {
    console.log(">>> tests of proposal cancelation, coming soon...");
    // it('Should create proposals correctly', async function () {
    //   // Test logic goes here
    // });
  });


});