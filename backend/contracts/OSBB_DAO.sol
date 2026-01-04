// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title OSBB_Token
 * @dev NON-TRANSFERABLE ERC20 токен тільки для голосування в ОСББ
 * Токени НЕ МОЖНА переказувати - вони прив'язані до квартири!
 */
contract OSBB_Token is ERC20, ERC20Permit, ERC20Votes, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor()
        ERC20("OSBB Voting Token", "OSBB")
        ERC20Permit("OSBB Voting Token")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) public onlyRole(MINTER_ROLE) {
        _burn(from, amount);
    }

    /**
     * @dev ЗАБОРОНА ТРАНСФЕРІВ - токени не можна переказувати!
     */
    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        require(
            from == address(0) || to == address(0),
            "Tokeny ne mozhna perekaduvaty! Vony pryviazani do kvartiry"
        );
        super._update(from, to, amount);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}

/**
 * @title OSBB_DAO
 * @dev Смарт-контракт для управління коштами ОСББ
 */
contract OSBB_DAO is AccessControl, ReentrancyGuard {
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    OSBB_Token public governanceToken;
    
    struct Proposal {
        uint256 id;
        string description;
        uint256 amount;
        address payable executor;
        uint256 deadline;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 snapshotId;
        bool executed;
        bool canceled;
    }

    struct ProposalView {
      uint256 id;
      string description;
      uint256 votesFor;
      uint256 votesAgainst;
      uint256 snapshotId;
      uint256 deadline;
      uint256 queuedAt;
      bool executed;
      bool canceled;
      ProposalState state;
      bool passed;
  }
    
    // Структура запису про голосування
    struct VoteReceipt {
        bool hasVoted;
        bool support;
        uint256 votes;
    }
    
    // Структура мешканця
    struct Resident {
        uint256 apartmentArea;
        address residentAddress;
        bool isActive;
    }
    
    // Змінні стану
    uint256 public totalArea;
    uint256 public constant TOKENS_PER_SQUARE_METER = 100;
    uint256 public constant QUORUM_PERCENTAGE = 80;
    uint256 public constant APPROVAL_THRESHOLD = 50;      // >50% голосів "ЗА"
    uint256 public constant MIN_VOTING_PERIOD = 3 days;
    uint256 public constant TIMELOCK_DELAY = 2 days;
    
    uint256 private _proposalIdCounter;
    
    mapping(address => Resident) public residents;
    mapping(uint256 => Proposal) public proposals;
    // ОКРЕМИЙ маппінг для голосів
    mapping(uint256 => mapping(address => VoteReceipt)) public voteReceipts;
    mapping(uint256 => uint256) public queuedAt;
    
    address[] public residentList;

    enum ProposalState {
      Active,      // голосование идёт
      Defeated,    // голосование завершено, но не прошло
      Succeeded,   // прошло голосование, но ещё не queued
      Queued,      // поставлено в очередь (timelock идёт)
      Executable,  // timelock закончился, можно исполнять
      Executed,    // исполнено
      Canceled     // отменено
    }

    
    // Події
    event ResidentRegistered(address indexed resident, uint256 apartmentArea, uint256 votingPower);
    event ResidentRemoved(address indexed resident, uint256 votingPower);
    event FundsDeposited(address indexed from, uint256 amount);
    event ProposalCreated(
        uint256 indexed proposalId, 
        address indexed proposer,
        string description, 
        uint256 amount, 
        address executor,
        uint256 deadline
    );
    event VoteCast(
        address indexed voter, 
        uint256 indexed proposalId, 
        bool support, 
        uint256 votes
    );
    event ProposalExecuted(uint256 indexed proposalId, address indexed executor, uint256 amount);
    event ProposalCanceled(uint256 indexed proposalId);
    event ProposalQueued(uint256 indexed proposalId, uint256 queuedAt);
    
    modifier proposalExists(uint256 _proposalId) {
        require(_proposalId > 0 && _proposalId <= _proposalIdCounter, "Propozyciya ne isnuye");
        _;
    }
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        
        governanceToken = new OSBB_Token();
        governanceToken.grantRole(governanceToken.MINTER_ROLE(), address(this));
    }
    
    function registerResident(address _resident, uint256 _apartmentArea) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(!residents[_resident].isActive, "Meshkanets vzhe zareyestrovanyy");
        require(_apartmentArea > 0, "Ploshcha kvartiry maye buty bilshe 0");
        require(_resident != address(0), "Nevirna adresa");
        
        uint256 votingPower = _apartmentArea * TOKENS_PER_SQUARE_METER;
        
        residents[_resident] = Resident({
            apartmentArea: _apartmentArea,
            residentAddress: _resident,
            isActive: true
        });
        
        residentList.push(_resident);
        totalArea += _apartmentArea;
        
        governanceToken.mint(_resident, votingPower);
        
        emit ResidentRegistered(_resident, _apartmentArea, votingPower);
    }
    
    function removeResident(address _resident) external onlyRole(ADMIN_ROLE) {
      require(residents[_resident].isActive, "Meshkanets ne zareyestrovanyy");

      uint256 area = residents[_resident].apartmentArea;
      uint256 votingPower = governanceToken.balanceOf(_resident);
      
      totalArea -= area;
      residents[_resident].isActive = false;
      
      if (votingPower > 0) {
          governanceToken.burn(_resident, votingPower);
      }
      
      for (uint256 i = 0; i < residentList.length; i++) {
          if (residentList[i] == _resident) {
              residentList[i] = residentList[residentList.length - 1];
              residentList.pop();
              break;
          }
      }
        
      emit ResidentRemoved(_resident, votingPower);
    }
    
    function depositFunds() external payable {
      require(msg.value > 0, "Suma maye buty bilshe 0");
      emit FundsDeposited(msg.sender, msg.value);
    }
    
    function getBalance() external view returns (uint256) {
      return address(this).balance;
    }
    
    function getVotingPower(address _resident) public view returns (uint256) {
      return governanceToken.balanceOf(_resident);
    }
    
    function createProposal(
      string memory _description,
      uint256 _amount,
      address payable _executor,
      uint256 _votingPeriod
    ) external returns (uint256) {
        require(governanceToken.balanceOf(msg.sender) > 0, "U vas nemaye prava stvoruvaty propozytsiyi");
        require(_amount > 0, "Suma maye buty bilshe 0");
        require(_amount <= address(this).balance, "Nedostatno koshtiv u fondi");
        require(_executor != address(0), "Nevirna adresa vykonavtsya");
        require(_votingPeriod >= MIN_VOTING_PERIOD, "Period holosuvannya zamalo");
        require(bytes(_description).length > 0, "Opys ne mozhe buty porozhnim");
        
        _proposalIdCounter++;
        uint256 newProposalId = _proposalIdCounter;
        uint256 deadline = block.timestamp + _votingPeriod;

        uint256 snapshotBlock = block.number > 0 ? block.number - 1 : 0;
        
        proposals[newProposalId] = Proposal({
          id: newProposalId,
          description: _description,
          amount: _amount,
          executor: _executor,
          deadline: deadline,
          snapshotId: snapshotBlock,
          votesFor: 0,
          votesAgainst: 0,
          executed: false,
          canceled: false
        });
        
        emit ProposalCreated(newProposalId, msg.sender, _description, _amount, _executor, deadline);
        
        return newProposalId;
    }
    
    function castVote(uint256 _proposalId, bool _support) 
        external 
        proposalExists(_proposalId) 
    {
        Proposal storage proposal = proposals[_proposalId];
        require(block.number > proposal.snapshotId, "Golosuvannya shche ne pochalosya");
        require(block.timestamp <= proposal.deadline, "Termin holosuvannya zakinchyvsya");
        require(!proposal.executed, "Propozyciya vzhe vykonana");
        require(!proposal.canceled, "Propozyciya skasovana");
        require(!voteReceipts[_proposalId][msg.sender].hasVoted, "Vy vzhe proholosuvaly");
        
        uint256 votes = governanceToken.getPastVotes(msg.sender, proposal.snapshotId);
        require(votes > 0, "U vas nemaye prava holosu");
        
        voteReceipts[_proposalId][msg.sender] = VoteReceipt({
          hasVoted: true,
          support: _support,
          votes: votes
        });
        
        if (_support) {
          proposal.votesFor += votes;
        } else {
          proposal.votesAgainst += votes;
        }
        
        emit VoteCast(msg.sender, _proposalId, _support, votes);
    }
    
    function proposalSucceeded(uint256 _proposalId) public view proposalExists(_proposalId) returns (bool) {
      Proposal storage proposal = proposals[_proposalId];
      
      if (proposal.canceled || proposal.executed) {
        return false;
      }
      
      return _proposalPassed(_proposalId);
    }

     /**
     * @dev Детальна інформація про стан голосування
     */
    function getProposalVotingStats(uint256 _proposalId) 
        external 
        view 
        proposalExists(_proposalId)
        returns (
            uint256 totalSupply,
            uint256 votedTokens,
            uint256 votedFor,
            uint256 votedAgainst,
            uint256 participationRate,
            uint256 requiredQuorum,
            uint256 requiredApproval,
            bool quorumReached,
            bool approvalReached,
            bool allVoted
        )
    {
      Proposal storage proposal = proposals[_proposalId];
      
      totalSupply = governanceToken.getPastTotalSupply(proposal.snapshotId);
      votedFor = proposal.votesFor;
      votedAgainst = proposal.votesAgainst;
      votedTokens = votedFor + votedAgainst;
      
      requiredQuorum = QUORUM_PERCENTAGE;
      requiredApproval = APPROVAL_THRESHOLD;
        
      if (totalSupply > 0) {
          participationRate = (votedTokens * 100) / totalSupply;
          quorumReached = participationRate >= requiredQuorum;
          allVoted = votedTokens == totalSupply;
      } else {
          participationRate = 0;
          quorumReached = false;
          allVoted = false;
      }
        
      if (votedTokens > 0) {
          approvalReached = (votedFor * 100) > (votedTokens * requiredApproval);
      } else {
          approvalReached = false;
      }
      
      return (
        totalSupply,
        votedTokens,
        votedFor,
        votedAgainst,
        participationRate,
        requiredQuorum,
        requiredApproval,
        quorumReached,
        approvalReached,
        allVoted
      );
    }

    /**
     * @dev Перевірити чи всі резиденти проголосували
     */
    // function checkAllResidentsVoted(uint256 _proposalId)
    //     external
    //     view
    //     proposalExists(_proposalId)
    //     returns (
    //         bool allVoted,
    //         uint256 votedCount,
    //         uint256 totalCount
    //     )
    // {
    //     Proposal storage proposal = proposals[_proposalId];
    //     uint256 voted = 0;
    //     uint256 total = 0;
        
    //     for (uint256 i = 0; i < residentList.length; i++) {
    //         address resident = residentList[i];
    //         uint256 votingPower = governanceToken.getPastVotes(resident, proposal.snapshotId);
            
    //         if (votingPower > 0) {
    //             total++;
    //             if (voteReceipts[_proposalId][resident].hasVoted) {
    //                 voted++;
    //             }
    //         }
    //     }
        
    //     allVoted = (total > 0) && (voted == total);
        
    //     return (allVoted, voted, total);
    // }
    
    function queueProposal(uint256 _proposalId)
        external
        proposalExists(_proposalId)
    {
        Proposal storage proposal = proposals[_proposalId];

        require(!proposal.executed, "Already executed");
        require(!proposal.canceled, "Canceled");
        require(block.timestamp > proposal.deadline, "Voting not finished");
        require(proposalSucceeded(_proposalId), "Proposal not passed");
        require(queuedAt[_proposalId] == 0, "Already queued");

        queuedAt[_proposalId] = block.timestamp;

        emit ProposalQueued(_proposalId, block.timestamp);
    }
    
    function executeProposal(uint256 _proposalId) 
        external 
        nonReentrant 
        proposalExists(_proposalId) 
    {
        Proposal storage proposal = proposals[_proposalId];
        
        require(block.timestamp > proposal.deadline, "Voting not finished");
        require(!proposal.executed, "Already executed");
        require(!proposal.canceled, "Canceled");
        require(proposal.amount <= address(this).balance, "Not enough funds");
        require(queuedAt[_proposalId] != 0, "Proposal not queued");
        require(
            block.timestamp >= queuedAt[_proposalId] + TIMELOCK_DELAY,
            "Timelock not expired"
        );
        
        proposal.executed = true;
        
        (bool success, ) = proposal.executor.call{value: proposal.amount}("");
        require(success, "Transfer failed");
        
        emit ProposalExecuted(_proposalId, proposal.executor, proposal.amount);
    }
    
    function cancelProposal(uint256 _proposalId) 
        external 
        onlyRole(ADMIN_ROLE) 
        proposalExists(_proposalId) 
    {
        Proposal storage proposal = proposals[_proposalId];

        require(queuedAt[_proposalId] == 0, "Already queued");
        require(!proposal.executed, "Propozyciya vzhe vykonana");
        require(!proposal.canceled, "Propozyciya vzhe skasovana");
        
        bool votingActive = block.timestamp <= proposal.deadline;
        
        if (!votingActive) {
            bool proposalPassed = proposalSucceeded(_proposalId);
            require(!proposalPassed, "Ne mozhna skasuvaty odobrenu propozytsiyu");
        }
        
        proposal.canceled = true;
        emit ProposalCanceled(_proposalId);
    }
      
    /**
     * @dev Отримання детальної інформації про пропозицію
     * ТЕПЕР БЕЗ маппінгу - можна повертати!
     */
    function getProposal(uint256 proposalId)
        external
        view
        proposalExists(proposalId)
        returns (
          uint256 id,
          string memory description,
          uint256 amount,
          address executor,
          uint256 deadline,
          uint256 votesFor,
          uint256 votesAgainst,
          bool executed,
          bool canceled,
          bool succeeded,
          uint256 snapshotId
        )
    {
        Proposal storage proposal = proposals[proposalId];

        // ProposalState state = getProposalState(proposalId);
        bool passed = _proposalPassed(proposalId);

        return (
          proposal.id,
          proposal.description,
          proposal.amount,
          proposal.executor,
          proposal.deadline,
          proposal.votesFor,
          proposal.votesAgainst,
          proposal.executed,
          proposal.canceled,
          passed,
          proposal.snapshotId
        );

        // return ProposalView({
        //   id: proposalId,
        //   description: proposal.description,
        //   votesFor: proposal.votesFor,
        //   votesAgainst: proposal.votesAgainst,
        //   snapshotId: proposal.snapshotId,
        //   deadline: proposal.deadline,
        //   queuedAt: queuedAt[proposalId],
        //   executed: proposal.executed,
        //   canceled: proposal.canceled,
        //   state: state,
        //   passed: passed
        // });
    }

    
    function getProposalState(uint256 proposalId)
        public
        view
        proposalExists(proposalId)
        returns (ProposalState)
    {
        Proposal storage proposal = proposals[proposalId];

        if (proposal.canceled) {
            return ProposalState.Canceled;
        }

        if (proposal.executed) {
            return ProposalState.Executed;
        }

        // голосование ещё идёт
        if (block.timestamp <= proposal.deadline) {
            return ProposalState.Active;
        }

        // голосование завершено, но не прошло
        if (!_proposalPassed(proposalId)) {
            return ProposalState.Defeated;
        }

        // прошло голосование, но ещё не queued
        if (queuedAt[proposalId] == 0) {
            return ProposalState.Succeeded;
        }

        // timelock ещё идёт
        if (block.timestamp < queuedAt[proposalId] + TIMELOCK_DELAY) {
            return ProposalState.Queued;
        }

        // timelock закончился
        return ProposalState.Executable;
    }

    
    function getProposalCount() external view returns (uint256) {
        return _proposalIdCounter;
    }
    
    function getResidentCount() external view returns (uint256) {
        return residentList.length;
    }
    
    function getGovernanceToken() external view returns (address) {
        return address(governanceToken);
    }
    
    function getResidentInfo(address _resident) 
      external 
      view 
      returns (
        uint256 apartmentArea, 
        uint256 votingPower, 
        bool isActive
      ) {
        Resident memory resident = residents[_resident];
        return (
            resident.apartmentArea,
            getVotingPower(_resident),
            resident.isActive
        );
    }

    /**
     * @dev Перевірити чи проголосував користувач (тепер через окремий маппінг)
     */
    function isVoted(uint256 _proposalId, address _voter) 
        external 
        view 
        proposalExists(_proposalId) 
        returns (bool) 
    {
        return voteReceipts[_proposalId][_voter].hasVoted;
    }

    /**
     * @dev Отримати інформацію про голос (тепер через окремий маппінг)
     */
    function getVoteReceipt(uint256 _proposalId, address _voter)
        external
        view
        proposalExists(_proposalId)
        returns (bool hasVoted, bool support, uint256 votes)
    {
        VoteReceipt memory receipt = voteReceipts[_proposalId][_voter];
        return (receipt.hasVoted, receipt.support, receipt.votes);
    }

    function _proposalPassed(uint256 proposalId)
      internal
      view
      returns (bool)
    {
      Proposal storage proposal = proposals[proposalId];

      uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;

      // защита от деления на ноль
      if (totalVotes == 0) {
          return false;
      }

      // total supply на момент snapshot
      uint256 totalSupplyAtSnapshot =
          governanceToken.getPastTotalSupply(proposal.snapshotId);

      // 1️⃣ QUORUM: участвовало достаточно токенов
      bool quorumReached =
          (totalVotes * 100) >= (totalSupplyAtSnapshot * QUORUM_PERCENTAGE);

      // 2️⃣ APPROVAL: достаточно "ЗА" среди проголосовавших
      bool approvalReached =
          (proposal.votesFor * 100) >= (totalVotes * APPROVAL_THRESHOLD);

      return quorumReached && approvalReached;
    }

    
    receive() external payable {
        emit FundsDeposited(msg.sender, msg.value);
    }
    
    fallback() external payable {
        emit FundsDeposited(msg.sender, msg.value);
    }
}