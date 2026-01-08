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

    beforeEach(async function () {
      await osbbDAO.registerResident(await member1.getAddress(), APPARTMENT_AREA_1);
      await osbbDAO.registerResident(await member2.getAddress(), APPARTMENT_AREA_2);
    });


    it('Should remove a resident correctly', async function () {
      const votingPower = APPARTMENT_AREA_1 * TOKENS_PER_SQM;
      const residentAddress1 = await member1.getAddress();

      await expect(osbbDAO.removeResident(residentAddress1))
        .to.emit(osbbDAO, 'ResidentRemoved')
        .withArgs(residentAddress1, votingPower);

      const residentInfo = await osbbDAO.getResidentInfo(residentAddress1);

      expect(residentInfo.isActive).to.be.false;
      expect(residentInfo.votingPower).to.equal(0);

      expect(await osbbDAO.totalArea()).to.equal(APPARTMENT_AREA_2);
      expect(await osbbDAO.getResidentCount()).to.equal(1);
    });

    it('Should burn governance tokens when removing resident', async function () {
      const residentAddress1 = await member1.getAddress();

      await osbbDAO.removeResident(residentAddress1);
      expect(await governanceToken.balanceOf(residentAddress1)).to.equal(0n);
    });

    it('Should revert when removing non-existent resident', async function () {
      await expect(osbbDAO.removeResident(await member3.getAddress()))
        .to.be.revertedWith("Meshkanets ne zareyestrovanyy");
    });

    it('Should revert if non-admin tries to remove resident', async function () {
      await expect(
        osbbDAO.connect(member1).removeResident(await member2.getAddress())
      ).to.be.revertedWithCustomError(osbbDAO, "AccessControlUnauthorizedAccount");
    });
  });

  describe('Fund Deposits', function () {
    it('Should accept deposits via depositFunds correctly', async function () {
      const depositAmount = ethers.parseEther("0.5");

      await expect(osbbDAO.depositFunds({ value: depositAmount }))
        .to.emit(osbbDAO, 'FundsDeposited')
        .withArgs(owner.getAddress(), depositAmount);

      expect(await osbbDAO.getBalance()).to.equal(depositAmount);
      // console.log(">>> cur balance:", await osbbDAO.getBalance(), await governanceToken.balanceOf('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'));

      // console.log(">>> test depositFunds passed", await owner.getAddress());
      // console.log(">>> test depositFunds passed", osbbDAO);
      
    });

    it('Should accumulate funds correctly', async function () {
      const depositAmount1 = ethers.parseEther("1.0");
      const depositAmount2 = ethers.parseEther("0.5");

      await osbbDAO.depositFunds({ value: depositAmount1 });
      await osbbDAO.depositFunds({ value: depositAmount2 });

      expect(await osbbDAO.getBalance()).to.equal(depositAmount1 + depositAmount2);
    });

    it('Should revert with zero deposit', async function () {
      await expect(osbbDAO.depositFunds({ value: 0n }))
        .to.be.revertedWith("Suma maye buty bilshe 0");
    });

    it('Should accept deposits via direct ETH transfer', async function () {
      const depositAmount = ethers.parseEther("0.75");

      await expect(owner.sendTransaction({
        to: await osbbDAO.getAddress(),
        value: depositAmount
      }))
        .to.emit(osbbDAO, 'FundsDeposited')
        .withArgs(await owner.getAddress(), depositAmount);
        
      expect(await osbbDAO.getBalance()).to.equal(depositAmount);
    });
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