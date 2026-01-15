# OSBB DAO - Decentralized Housing Cooperative Management

A blockchain-based governance system for Ukrainian housing cooperatives (OSBB - Об'єднання співвласників багатоквартирного будинку). This project implements a complete DAO solution with non-transferable voting tokens, proposal management, and democratic fund allocation.

## 🏢 Overview

OSBB DAO enables transparent and democratic management of residential building finances through blockchain technology. Voting power is distributed based on apartment size, ensuring fair representation of all residents.

### Key Features

- **Non-transferable Voting Tokens**: Tokens are bound to apartments and cannot be transferred
- **Proportional Voting**: Voting power based on apartment area (100 tokens per m²)
- **Democratic Proposals**: Any resident can create funding proposals
- **Timelock Security**: 2-day delay between approval and execution
- **Quorum Requirements**: 80% participation required for valid voting
- **Admin Controls**: Resident registration and emergency cancellations

## 📋 Requirements

- Node.js >= 18.x
- npm or yarn
- Hardhat local node

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/JuliaKorolenko/osbb-dao.git
cd osbb-dao
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

## 🔧 Configuration

### Backend Setup

Create a `.env` file in the `backend` directory:

```env
# Optional: for testnet deployment
RPC_URL=http://localhost:8545
PRIVATE_KEY=your_private_key
```

### Frontend Setup

Create a `.env` file in the `frontend` directory:

```env
VITE_RPC_URL=http://127.0.0.1:8545
VITE_DAO_ADDRESS=<deployed_contract_address>
```

## 🎯 Usage

### Starting the Development Environment

#### 1. Start Hardhat Local Node

In the `backend` directory:

```bash
npx hardhat node
```

This starts a local Ethereum node at `http://127.0.0.1:8545` with 20 pre-funded test accounts.

#### 2. Deploy Smart Contracts

In a new terminal, from the `backend` directory:

```bash
npx hardhat ignition deploy ignition/modules/OSBB_DAO.ts --network localhost
```

The deployment script will:
- Deploy the OSBB_DAO contract
- Create OSBB_Token governance token
- Register 4 initial residents (including admin)
- Deposit 10 ETH into the DAO treasury

**Important**: Copy the deployed contract address and update `VITE_DAO_ADDRESS` in `frontend/.env`

#### 3. Start Frontend Development Server

In the `frontend` directory:

```bash
npm run dev
```

Access the application at `http://localhost:5173`


## 🏗️ Project Structure

```
osbb-dao/
├── backend/
│   ├── contracts/
│   │   └── OSBB_DAO.sol          # Main DAO contract
│   ├── ignition/
│   │   └── modules/
│   │       └── OSBB_DAO.ts       # Deployment script
│   │── test/
│   │   └── OSBB_DAO.test.ts
│   ├── hardhat.config.ts
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── services/
    │   │   └── contractService.ts # Smart contract interaction layer
    │   ├── contracts/             # ABI files (copy from backend/artifacts)
    │   ├── main.ts                # Application entry point
    │   └── style.css
    ├── index.html
    └── package.json
```

## 📝 Smart Contract Architecture

### OSBB_Token
- ERC20-based governance token
- Implements ERC20Votes for snapshot voting
- Non-transferable (bound to apartments)
- Minted/burned only by DAO contract

### OSBB_DAO
- Main governance contract
- Manages residents and voting power
- Proposal lifecycle management
- Treasury management with timelock

### Governance Parameters

```solidity
TOKENS_PER_SQUARE_METER = 100     // Voting power per m²
QUORUM_PERCENTAGE = 80            // Required participation
APPROVAL_THRESHOLD = 50           // Required approval percentage
MIN_VOTING_PERIOD = 3 days        // Minimum voting duration
TIMELOCK_DELAY = 2 days           // Execution delay after approval
```

## 🔐 Security Features

1. **Role-Based Access Control**: Admin-only functions for resident management
2. **Timelock Mechanism**: Mandatory delay before proposal execution
3. **Non-Transferable Tokens**: Prevents voting power manipulation
4. **Reentrancy Protection**: Safe fund transfers
5. **Snapshot Voting**: Historical balance checking prevents flash loan attacks

## 🎮 User Flows

### Admin Flow
1. Connect with admin account (Account 0)
2. Register new residents with apartment sizes
3. Monitor proposals and voting
4. Cancel proposals if necessary

### Resident Flow
1. Select your account from dropdown
2. Create proposals for fund allocation
3. Vote on active proposals
4. View proposal status and history

### Proposal Lifecycle
1. **Created**: Any resident can create
2. **Active**: Voting period (minimum 3 days)
3. **Queued**: Approved proposals enter timelock
4. **Executable**: After 2-day delay
5. **Executed**: Funds transferred to executor

## 🛠️ Development Tools

### Time Manipulation (Dev Tools Tab)
- Fast forward time by hours/days
- Jump to proposal deadline
- Test timelock functionality

### Account Switching
- Test from different resident perspectives
- Verify voting restrictions
- Test admin functions

## 📊 Testing

### Run Tests

```bash
cd backend
npx hardhat test
```

## 📦 Technology Stack

### Backend
- Solidity ^0.8.28
- Hardhat 3.0.7
- OpenZeppelin Contracts 5.4.0
- Ethers.js 6.15.0

### Frontend
- TypeScript 5.9.3
- Vite 7.2.4
- Ethers.js 6.15.0
- Vanilla JavaScript (no framework)

## 🐛 Troubleshooting

### Contract Address Not Found
- Ensure Hardhat node is running
- Verify `.env` files are configured
- Check that deployment completed successfully

### Voting Not Working
- Ensure tokens are delegated (automatic on registration)
- Verify you're registered as a resident
- Check voting period hasn't expired

### Transaction Failures
- Ensure sufficient ETH balance for gas
- Verify you have required role for action
- Check proposal status and timelock requirements


## 🎓 Educational Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [Solidity Documentation](https://docs.soliditylang.org/)

---

⭐ If you find this project useful, please consider giving it a star on GitHub!