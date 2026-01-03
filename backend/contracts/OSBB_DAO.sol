// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "../node_modules/@openzeppelin/contracts/access/AccessControl.sol";
import "../node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// таймлог

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
     * Токени представляють право голосу власника квартири
     * і не можуть бути продані або передані
     */
    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        // Дозволяємо тільки mint (from == address(0)) і burn (to == address(0))
        require(
            from == address(0) || to == address(0),
            "Tokeny ne mozhna perekaduvaty! Vony pryviazani do kvartiry"
        );
        super._update(from, to, amount);
    }

    // Необхідні override функції
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
 * Використовує non-transferable токени для голосування
 */
contract OSBB_DAO is AccessControl, ReentrancyGuard {
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    OSBB_Token public governanceToken;
    
    // Структура пропозиції
    struct Proposal {
        uint256 id;
        string description;
        uint256 amount;
        address payable executor;
        uint256 deadline;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 snapshotId; // Snapshot токенів на момент створення
        bool executed;
        bool canceled;
        mapping(address => VoteReceipt) receipts;
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
    uint256 public constant TOKENS_PER_SQUARE_METER = 100; // 100 токенів = 1 м²
    uint256 public constant QUORUM_PERCENTAGE = 50; // 50% для кворуму
    uint256 public constant MIN_VOTING_PERIOD = 3 days;
    uint256 public constant TIMELOCK_DELAY = 2 days;
    
    uint256 private _proposalIdCounter;
    
    mapping(address => Resident) public residents;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => uint256) public queuedAt; // queuedAt — время, когда proposal был поставлен в очередь.
    
    address[] public residentList;
    
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
    
    // Модифікатори
    modifier proposalExists(uint256 _proposalId) {
        require(_proposalId > 0 && _proposalId <= _proposalIdCounter, "Propozyciya ne isnuye");
        _;
    }
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        
        // Створюємо NON-TRANSFERABLE токен голосування
        governanceToken = new OSBB_Token();
        governanceToken.grantRole(governanceToken.MINTER_ROLE(), address(this));
    }
    
    /**
     * @dev Реєстрація мешканця з площею квартири
     * Токени НЕ МОЖНА продати - вони прив'язані до квартири!
     * @param _resident Адреса мешканця
     * @param _apartmentArea Площа квартири в м²
     */
    function registerResident(address _resident, uint256 _apartmentArea) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(!residents[_resident].isActive, "Meshkanets vzhe zareyestrovanyy");
        require(_apartmentArea > 0, "Ploshcha kvartiry maye buty bilshe 0");
        require(_resident != address(0), "Nevirna adresa");
        
        // Розраховуємо кількість токенів (право голосу)
        uint256 votingPower = _apartmentArea * TOKENS_PER_SQUARE_METER;
        
        residents[_resident] = Resident({
            apartmentArea: _apartmentArea,
            residentAddress: _resident,
            isActive: true
        });
        
        residentList.push(_resident);
        totalArea += _apartmentArea;
        
        // Випускаємо токени голосування (НЕ ВАЛЮТА!)
        governanceToken.mint(_resident, votingPower);
        
        emit ResidentRegistered(_resident, _apartmentArea, votingPower);
    }
    
    /**
     * @dev Видалення мешканця (спалення токенів голосування)
     * @param _resident Адреса мешканця
     */
    function removeResident(address _resident) external onlyRole(ADMIN_ROLE) {
        require(residents[_resident].isActive, "Meshkanets ne zareyestrovanyy");
        // require(!hasActiveProposal, "Cannot remove during active voting");
        
        uint256 area = residents[_resident].apartmentArea;
        uint256 votingPower = governanceToken.balanceOf(_resident);
        
        totalArea -= area;
        residents[_resident].isActive = false;
        
        // Спалюємо токени голосування
        if (votingPower > 0) {
            governanceToken.burn(_resident, votingPower);
        }
        
        // Видалення з масиву residentList
        for (uint256 i = 0; i < residentList.length; i++) {
            if (residentList[i] == _resident) {
                residentList[i] = residentList[residentList.length - 1];
                residentList.pop();
                break;
            }
        }
        
        emit ResidentRemoved(_resident, votingPower);
    }
    
    /**
     * @dev Поповнення загального фонду ОСББ (реальні гроші - ETH)
     */
    function depositFunds() external payable {
        require(msg.value > 0, "Suma maye buty bilshe 0");
        emit FundsDeposited(msg.sender, msg.value);
    }
    
    /**
     * @dev Отримання балансу ОСББ (реальні гроші)
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Отримання ваги голосу мешканця (НЕ гроші, а право голосу!)
     * @param _resident Адреса мешканця
     */
    function getVotingPower(address _resident) public view returns (uint256) {
        return governanceToken.balanceOf(_resident);
    }
    
    /**
     * @dev Створення нової пропозиції
     * @param _description Опис пропозиції
     * @param _amount Сума витрат у wei (реальні ETH!)
     * @param _executor Адреса виконавця
     * @param _votingPeriod Період голосування в секундах
     */
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
        // uint256 deadline = block.timestamp + 3 minutes;
        
        Proposal storage newProposal = proposals[newProposalId];
        newProposal.id = newProposalId;
        newProposal.description = _description;
        newProposal.amount = _amount;
        newProposal.executor = _executor;
        newProposal.deadline = deadline;
        // newProposal.snapshotId = block.number - 1; // Використовуємо block.number як snapshot
        newProposal.snapshotId = block.number; // Використовуємо block.number як snapshot
        newProposal.votesFor = 0;
        newProposal.votesAgainst = 0;
        newProposal.executed = false;
        newProposal.canceled = false;
        
        emit ProposalCreated(newProposalId, msg.sender, _description, _amount, _executor, deadline);
        
        return newProposalId;
    }
    
    /**
     * @dev Голосування за пропозицію
     * Вага голосу = кількість токенів (площа квартири)
     * @param _proposalId ID пропозиції
     * @param _support true - за, false - проти
     */
    function castVote(uint256 _proposalId, bool _support) 
        external 
        proposalExists(_proposalId) 
    {
        Proposal storage proposal = proposals[_proposalId];
        require(block.number > proposal.snapshotId, "Golosuvannya shche ne pochalosya");
        
        require(block.timestamp <= proposal.deadline, "Termin holosuvannya zakinchyvsya");
        require(!proposal.executed, "Propozyciya vzhe vykonana");
        require(!proposal.canceled, "Propozyciya skasovana");
        require(!proposal.receipts[msg.sender].hasVoted, "Vy vzhe proholosuvaly");
        
        // Використовуємо баланс на момент створення пропозиції
        uint256 votes = governanceToken.getPastVotes(msg.sender, proposal.snapshotId);
        require(votes > 0, "U vas nemaye prava holosu");
        
        proposal.receipts[msg.sender] = VoteReceipt({
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
    
    /**
     * @dev Перевірка чи пропозиція пройшла
     * @param _proposalId ID пропозиції
     */
    function proposalSucceeded(uint256 _proposalId) public view proposalExists(_proposalId) returns (bool) {
        Proposal storage proposal = proposals[_proposalId];
        
        uint256 totalSupply = governanceToken.getPastTotalSupply(proposal.snapshotId);
        if (totalSupply == 0) return false;
        
        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        
        // Перевірка кворуму (мінімум 50% токенів повинно проголосувати)
        bool quorumReached = (totalVotes * 100) >= (totalSupply * QUORUM_PERCENTAGE);
        
        // Перевірка більшості (більше 50% голосів "за")
        bool majorityReached = proposal.votesFor > proposal.votesAgainst;
        
        return quorumReached && majorityReached;
    }
    
    /**
     * @dev Виконання схваленої пропозиції
     * Переказує РЕАЛЬНІ ГРОШІ (ETH), а не токени!
     * @param _proposalId ID пропозиції
     */
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
        
        // Переказ РЕАЛЬНИХ коштів (ETH) виконавцю
        (bool success, ) = proposal.executor.call{value: proposal.amount}("");
        require(success, "Transfer failed");
        
        emit ProposalExecuted(_proposalId, proposal.executor, proposal.amount);
    }
    
    /**
     * @dev Скасування пропозиції (тільки адмін)
     * @param _proposalId ID пропозиції
     */
    function cancelProposal(uint256 _proposalId) 
        external 
        onlyRole(ADMIN_ROLE) 
        proposalExists(_proposalId) 
    {
        Proposal storage proposal = proposals[_proposalId];

        require(queuedAt[_proposalId] == 0, "Already queued");
        require(!proposal.executed, "Propozyciya vzhe vykonana");
        require(!proposal.canceled, "Propozyciya vzhe skasovana");
        
        // Перевіряємо чи можна скасувати
        bool votingActive = block.timestamp <= proposal.deadline;
        bool proposalPassed = false;
        
        if (!votingActive) {
            // Якщо голосування закінчилось, перевіряємо чи пройшла
            proposalPassed = proposalSucceeded(_proposalId);
            require(!proposalPassed, "Ne mozhna skasuvaty odobrenu propozytsiyu");
        }
        
        proposal.canceled = true;
        emit ProposalCanceled(_proposalId);
    }
      
    /**
     * @dev Отримання детальної інформації про пропозицію
     * @param _proposalId ID пропозиції
     */
    function getProposal(uint256 _proposalId) 
        external 
        view 
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
        // Перевірка без модифікатора, щоб не було revert
        require(_proposalId > 0 && _proposalId <= _proposalIdCounter, "Propozyciya ne isnuye");
        
        Proposal storage proposal = proposals[_proposalId];
        
        // Перевірка чи пройшла (inline без виклику функції)
        bool proposalSucceededResult = false;
        
        if (!proposal.canceled && !proposal.executed) {
          uint256 totalSupply = governanceToken.getPastTotalSupply(proposal.snapshotId);
            
          if (totalSupply > 0) {
            uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
            bool quorumReached = (totalVotes * 100) >= (totalSupply * QUORUM_PERCENTAGE);
            bool majorityReached = proposal.votesFor > proposal.votesAgainst;
            proposalSucceededResult = quorumReached && majorityReached;
          }
        }
        
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
          proposalSucceededResult,
          proposal.snapshotId
        );
    }
    
    /**
     * @dev Отримання стану пропозиції
     * @param _proposalId ID пропозиції
     */
    function getProposalState(uint256 _proposalId) 
        external 
        view 
        proposalExists(_proposalId) 
        returns (string memory) 
    {
        Proposal storage proposal = proposals[_proposalId];
        
        if (proposal.canceled) {
            return "Canceled";
        }
        if (proposal.executed) {
            return "Executed";
        }
        if (block.timestamp <= proposal.deadline) {
            return "Active";
        }
        if (proposalSucceeded(_proposalId)) {
            return "Succeeded";
        }
        return "Defeated";
    }
    
    /**
     * @dev Отримання загальної кількості пропозицій
     */
    function getProposalCount() external view returns (uint256) {
        return _proposalIdCounter;
    }
    
    /**
     * @dev Отримання кількості мешканців
     */
    function getResidentCount() external view returns (uint256) {
        return residentList.length;
    }
    
    /**
     * @dev Отримання адреси токена голосування
     */
    function getGovernanceToken() external view returns (address) {
        return address(governanceToken);
    }
    
    /**
     * @dev Отримання інформації про мешканця
     */
    function getResidentInfo(address _resident) 
        external 
        view 
        returns (
            uint256 apartmentArea, 
            uint256 votingPower, 
            bool isActive
        ) 
    {
        Resident memory resident = residents[_resident];
        return (
            resident.apartmentArea,
            getVotingPower(_resident),
            resident.isActive
        );
    }

    /**
    * @dev Перевірити чи проголосував користувач за пропозицію
    * @param _proposalId ID пропозиції
    * @param _voter Адреса голосуючого
    */
    function isVoted(uint256 _proposalId, address _voter) 
      external 
      view 
      proposalExists(_proposalId) 
      returns (bool) 
    {
        return proposals[_proposalId].receipts[_voter].hasVoted;
    }

    /**
    * @dev Отримати інформацію про голос користувача
    * @param _proposalId ID пропозиції
    * @param _voter Адреса голосуючого
    */
    function getVoteReceipt(uint256 _proposalId, address _voter)
      external
      view
      proposalExists(_proposalId)
      returns (bool hasVoted, bool support, uint256 votes)
    {
        VoteReceipt memory receipt = proposals[_proposalId].receipts[_voter];
        return (receipt.hasVoted, receipt.support, receipt.votes);
    }

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
    
    /**
     * @dev Функція для прийому ETH (реальних грошей)
     */
    receive() external payable {
        emit FundsDeposited(msg.sender, msg.value);
    }
    
    /**
     * @dev Fallback функція
     */
    fallback() external payable {
        emit FundsDeposited(msg.sender, msg.value);
    }
}