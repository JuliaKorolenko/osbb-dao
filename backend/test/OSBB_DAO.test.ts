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
    beforeEach(async function () {
      await osbbDAO.registerResident(await member1.getAddress(), APPARTMENT_AREA_1);
      await osbbDAO.depositFunds({ value: ethers.parseEther("10") });
    });

    it('Should create a proposal correctly', async function () {
      const proposalDescription = "Fix the roof";
      const proposalAmount = ethers.parseEther("2");
      const votingDuration = MIN_VOTING_DURATION;
      const executorAddress = await executor.getAddress();

      await expect(
        osbbDAO.connect(member1).createProposal(
        proposalDescription,
        proposalAmount,
        executorAddress,
        votingDuration
      )).to.emit(osbbDAO, 'ProposalCreated');

      const proposal = await osbbDAO.proposals(1);

      expect(proposal.description).to.equal(proposalDescription);
      expect(proposal.amount).to.equal(proposalAmount);
      expect(proposal.executor).to.equal(executorAddress);
      expect(proposal.executed).to.be.false;
      expect(proposal.canceled).to.be.false;
    });

    it('Should increment proposal counter', async function () {

      await osbbDAO.connect(member1).createProposal(
        "Proposal 1",
        ethers.parseEther("1"),
        await executor.getAddress(),
        MIN_VOTING_DURATION
      );

      await osbbDAO.connect(member1).createProposal(
        "Proposal 2",
        ethers.parseEther("1"),
        await executor.getAddress(),
        MIN_VOTING_DURATION
      );
      expect(await osbbDAO.getProposalCount()).to.equal(2);
    });

    it('Should revert if non-resident tries to create proposal', async function () {
      await expect(
        osbbDAO.connect(member2).createProposal(
          "Unauthorized Proposal",
          ethers.parseEther("1"),
          await executor.getAddress(),
          MIN_VOTING_DURATION
        )
      ).to.be.revertedWith("U vas nemaye prava stvoruvaty propozytsiyi");
    });

    it('Should revert with zero amount', async function () {
      await expect(
        osbbDAO.connect(member1).createProposal(
          "Zero Amount Proposal",
          0n,
          await executor.getAddress(),
          MIN_VOTING_DURATION
        )
      ).to.be.revertedWith("Suma maye buty bilshe 0");
    });

    it('Should revert with amount exceeding balance', async function () {
      await expect(
        osbbDAO.connect(member1).createProposal(
          "Excessive Amount Proposal",
          ethers.parseEther("20"),
          await executor.getAddress(),
          MIN_VOTING_DURATION
        )
      ).to.be.revertedWith("Nedostatno koshtiv u fondi");
    });

    it('Should revert with invalid executor address', async function () {
      await expect(
        osbbDAO.connect(member1).createProposal(
          "Invalid Executor Proposal",
          ethers.parseEther("1"),
          ethers.ZeroAddress,
          MIN_VOTING_DURATION
        )
      ).to.be.revertedWith("Nevirna adresa vykonavtsya");
    });

    it('Should revert with too short voting duration', async function () {
      await expect(
        osbbDAO.connect(member1).createProposal(
          "Short Voting Duration Proposal",
          ethers.parseEther("1"),
          await executor.getAddress(),
          MIN_VOTING_DURATION - 1n
        )
      ).to.be.revertedWith("Period holosuvannya zamalo");
    });

    it('Should revert with empty description', async function () {
      await expect(
        osbbDAO.connect(member1).createProposal(
          "",
          ethers.parseEther("1"),
          await executor.getAddress(),
          MIN_VOTING_DURATION
        )
      ).to.be.revertedWith("Opys ne mozhe buty porozhnim");
    });

  });

  describe('Voting', async function () {
    let proposalId: bigint;

    beforeEach(async function () {
      const member1Address = await member1.getAddress();
      const member2Address = await member2.getAddress();
      const member3Address = await member3.getAddress();

      await osbbDAO.registerResident(member1Address, APPARTMENT_AREA_1);
      await osbbDAO.registerResident(member2Address, APPARTMENT_AREA_2);
      await osbbDAO.registerResident(member3Address, APPARTMENT_AREA_3);
      await osbbDAO.depositFunds({ value: ethers.parseEther("10") });

      // Delegare voting power
      await governanceToken.connect(member1).delegate(member1Address);
      await governanceToken.connect(member2).delegate(member2Address);
      await governanceToken.connect(member3).delegate(member3Address);

      // Mine a block to ensure delegation is recorded
      await ethers.provider.send("evm_mine", []);

      // proposalId = await osbbDAO.connect(member1).createProposal.staticCall(
      //   "Test Proposal",
      //   ethers.parseEther("1"),
      //   await executor.getAddress(),
      //   MIN_VOTING_DURATION
      // );

      proposalId = await osbbDAO.getProposalCount() + 1n;

      await osbbDAO.connect(member1).createProposal(
        "Test Proposal",
        ethers.parseEther("1"),
        await executor.getAddress(),
        MIN_VOTING_DURATION
      );

      // Mine a block so voting can start
      await ethers.provider.send("evm_mine", []);
      
    });

    it('Should allow resident to vote', async function () {      
      const voteWeight = APPARTMENT_AREA_1 * TOKENS_PER_SQM;

      await expect(osbbDAO.connect(member1).castVote(proposalId, true))
        .to.emit(osbbDAO, 'VoteCast')
        .withArgs(
          await member1.getAddress(),
          proposalId,
          true,
          voteWeight
        );
      
      const receipt = await osbbDAO.getVoteReceipt(proposalId, await member1.getAddress());

      expect(receipt.hasVoted).to.be.true;
      expect(receipt.support).to.be.true;
      expect(receipt.votes).to.equal(voteWeight);
    });
    
    it('Should count votes correctly', async function () {
      await osbbDAO.connect(member1).castVote(proposalId, true);
      await osbbDAO.connect(member2).castVote(proposalId, false);
      await osbbDAO.connect(member3).castVote(proposalId, true);

      const proposal = await osbbDAO.getProposal(proposalId);

      const expectedForVotes = (APPARTMENT_AREA_1 + APPARTMENT_AREA_3) * TOKENS_PER_SQM;
      const expectedAgainstVotes = APPARTMENT_AREA_2 * TOKENS_PER_SQM;

      expect(proposal.votesFor).to.equal(expectedForVotes);
      expect(proposal.votesAgainst).to.equal(expectedAgainstVotes);
    });

    it('Should revert when voting twice', async function () {
      await osbbDAO.connect(member1).castVote(proposalId, true);

      await expect(osbbDAO.connect(member1).castVote(proposalId, false))
        .to.be.revertedWith("Vy vzhe proholosuvaly");
    });

    it('Should revert if non-resident votes', async function () {
      await expect(osbbDAO.connect(executor).castVote(proposalId, true))
        .to.be.revertedWith("U vas nemaye prava holosu");
    });

    it('Should revert if voting after deadline', async function () {
      const deadlineIncreased = Number(MIN_VOTING_DURATION) + 3600;
      await ethers.provider.send("evm_increaseTime", [deadlineIncreased]);

      await expect(osbbDAO.connect(member1).castVote(proposalId, true))
        .to.be.revertedWith("Termin holosuvannya zakinchyvsya");
    });

    it('Should revert voting on non-existent proposal', async function () {
      await expect(osbbDAO.connect(member1).castVote(999, true))
        .to.be.revertedWith("Propozyciya ne isnuye");
    });
  });


  describe('Is proposal successful', function () {
    let proposalId: bigint;

    beforeEach(async function () {
      const member1Address = await member1.getAddress();
      const member2Address = await member2.getAddress();
      const member3Address = await member3.getAddress();

      await osbbDAO.registerResident(member1Address, APPARTMENT_AREA_1); // 50m² = 5000 tokens
      await osbbDAO.registerResident(member2Address, APPARTMENT_AREA_2); // 75m² = 7500 tokens
      await osbbDAO.registerResident(member3Address, APPARTMENT_AREA_3); // 100m² = 10000 tokens
      // Total: 225m² = 22500 tokens

      await osbbDAO.depositFunds({ value: ethers.parseEther("10") });

      // Delegare voting power
      await governanceToken.connect(member1).delegate(member1Address);
      await governanceToken.connect(member2).delegate(member2Address);
      await governanceToken.connect(member3).delegate(member3Address);

      // Mine a block to ensure delegation is recorded
      await ethers.provider.send("evm_mine", []);

      proposalId = await osbbDAO.getProposalCount() + 1n;

      await osbbDAO.connect(member1).createProposal(
        "Test Proposal",
        ethers.parseEther("1"),
        await executor.getAddress(),
        MIN_VOTING_DURATION
      );

      // Mine a block so voting can start
      await ethers.provider.send("evm_mine", []);
      
    });

    it('Should pass with quorum and approval (all votes yes)', async function () {
      await osbbDAO.connect(member1).castVote(proposalId, true);
      await osbbDAO.connect(member2).castVote(proposalId, true);
      await osbbDAO.connect(member3).castVote(proposalId, true);
      // 100% participation, 100% approval

      await ethers.provider.send("evm_increaseTime", [Number(MIN_VOTING_DURATION)]);

      const isSuccessful = await osbbDAO.proposalSucceeded(proposalId);
      expect(isSuccessful).to.be.true;
    });

    it('Should pass with 80% quorum and >50% approval', async function () {
      // Need 80% of 22500 = 18000 tokens
      // resident2 (7500) + resident3 (10000) = 17500 < 18000
      // All three needed for quorum
      await osbbDAO.connect(member1).castVote(proposalId, true);
      await osbbDAO.connect(member2).castVote(proposalId, true);
      await osbbDAO.connect(member3).castVote(proposalId, true);      

      await ethers.provider.send("evm_increaseTime", [Number(MIN_VOTING_DURATION)]);

      const isSuccessful = await osbbDAO.proposalSucceeded(proposalId);
      expect(isSuccessful).to.be.true;
    });

    it('Should pass with quorum and approval (majority votes yes)', async function () {
      await osbbDAO.connect(member1).castVote(proposalId, true);
      await osbbDAO.connect(member2).castVote(proposalId, false);
      await osbbDAO.connect(member3).castVote(proposalId, true);
      // 100% participation, 66.67% approval

      await ethers.provider.send("evm_increaseTime", [Number(MIN_VOTING_DURATION)]);

      const isSuccessful = await osbbDAO.proposalSucceeded(proposalId);
      expect(isSuccessful).to.be.true;
    });

    it('Should fail without quorum', async function () {
      await osbbDAO.connect(member1).castVote(proposalId, true);
      // Only member1 voted, but quorum requires 80% participation (18000 tokens)
      // member1 has 5000 tokens, so 5000 < 18000

      await ethers.provider.send("evm_increaseTime", [Number(MIN_VOTING_DURATION)]);

      const isSuccessful = await osbbDAO.proposalSucceeded(proposalId);
      expect(isSuccessful).to.be.false;
    });

    it('Should fail with quorum but not enough approval', async function () {
      await osbbDAO.connect(member1).castVote(proposalId, false);
      await osbbDAO.connect(member2).castVote(proposalId, false);
      await osbbDAO.connect(member3).castVote(proposalId, false);
      // 100% participation, 0% approval

      await ethers.provider.send("evm_increaseTime", [Number(MIN_VOTING_DURATION)]);

      const isSuccessful = await osbbDAO.proposalSucceeded(proposalId);
      expect(isSuccessful).to.be.false;
    });

    it('Should fail with no votes', async function () {
      await ethers.provider.send("evm_increaseTime", [Number(MIN_VOTING_DURATION)]);

      const isSuccessful = await osbbDAO.proposalSucceeded(proposalId);
      expect(isSuccessful).to.be.false;
    });
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