import { ethers, Contract, BrowserProvider } from 'ethers';
import DAO_ABI from './contracts/OSBB_DAO.json';
import TOKEN_ABI from './contracts/OSBB_TOKEN.json';

const DAO_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
// const CONTRACT_ADDRESS = import.meta.env.CONTRACT_ADDRESS;

// console.log(">>> address", CONTRACT_ADDRESS);

  const CONFIG = {
    RPC_URL: "http://127.0.0.1:8545",
    DAO_ADDRESS: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // ← Вставте сюди
    TOKEN_ADDRESS: "YOUR_TOKEN_ADDRESS_HERE" // Залишіть так, отримається автоматично
  };



let provider: ethers.JsonRpcProvider;
let signer: ethers.JsonRpcSigner;
// let contract: Contract;
let userAddress: string;
let networkName: string;

provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

const allAccounts = await provider.listAccounts();

console.log(">>> all accounts", allAccounts);

const currentAccount = allAccounts[0];

signer = await provider.getSigner(0);
userAddress = await signer.getAddress();
const network = await provider.getNetwork();
const chainId = Number(network.chainId);
networkName = chainId === 31337 ? "Hardhat Local" : network.name;

const daoContract = new ethers.Contract(
    DAO_ADDRESS,  // ← Адреса з кроку 1
    DAO_ABI.abi,             // ← ABI з кроку 2
    signer        // ← Для підпису транзакцій
);


const tokenAddress = await daoContract.getGovernanceToken();

const tokenContract = new ethers.Contract(
  tokenAddress,        // ← Отримали автоматично
  TOKEN_ABI.abi,           // ← ABI з кроку 2
  provider             // ← Тільки для читання
);

console.log("DAO:", await daoContract.getAddress());
console.log("Token:", await tokenContract.getAddress());
console.log("Balance:", await daoContract.getBalance());
// export async function subscribeToAccountChanges(callback: (info: AccountChangeInfo) => void)  {
//   if (!window.ethereum) return;
  
//   window.ethereum.on("accountsChanged", async (accounts) => {
//     const addresses = accounts as string[];
//     if (addresses.length > 0) {
//       console.log('🔄 Аккаунт изменён:', addresses[0]);

//       // Создаём новый provider при каждой смене аккаунта
//       await setConnectionData();
//       const  contract: Contract = await createContractInstance();
//       callback({ signer, userAddress: addresses[0], provider, networkName, contract });
//     } else {
//       console.log('❌ Все аккаунты отключены');
//       // callback({ signer: null, userAddress: '', provider: null, networkName: '', contract: null });
//     }
//   });

// }

// // Подключение MetaMask
// export async function connectMetaMask() {
//   if (!window.ethereum) {
//     throw new Error("MetaMask is not installed");
//   }

//   try {
//      // Запрашиваем разрешение на подключение
//     await window.ethereum.request({ method: "eth_requestAccounts" });

//     await setConnectionData();

//     const  contract: Contract = await createContractInstance();

//     return { signer, userAddress, networkName, provider, contract };

//   } catch (error) {
//     console.error("Ошибка при подключении:", error);
//   }
// }

// Получение баланса
// export async function getBalance(address: string, provider: ethers.BrowserProvider): Promise<string> {
//   const balance = await provider.getBalance(address);
//   return ethers.formatEther(balance);
// }

// export async function IsOwner(): Promise<boolean> {
//   const contract: Contract = await createContractInstance();
//   const owner = await contract.owner();
//   return owner.toLowerCase() === userAddress.toLowerCase();
// }

// export async function BuyCollection(): Promise<void> {
//   const contract: Contract = await createContractInstance();
//   const collectionPrice = await contract.getCollectionPrice();

//   const hasCollection = await contract.hasCollection(userAddress);

//   if (hasCollection) {
//     console.log("⚠️ У вас уже есть коллекция. Она будет перезаписана!");
//   }


//   try {
//     const tx = await contract.buyCollection({
//       value: collectionPrice,
//     });
//     await tx.wait();
//     console.log("Collection purchased successfully");
//     // const allIds = (await contract.getAllWarriorIds()).map((id: any) => id.toString());
//     // // const stats = await contract.getWarriorStats(allIds[0]);
//     // console.log(">>> allIds", allIds);
//     // // console.log(">>> stats", `Name: ${stats.name}, Strength: ${Number(stats.strength)}, Defense: ${Number(stats.defense)}, Rarity: ${Number(stats.rarity)}`);
//     // // console.log(">>> stats", `Name: ${stats.name}, Strength: ${Number(stats.rarity)}`);

//     // for (let tokenId of allIds) {
//     //   const stats = await contract.getWarriorStats(tokenId);
//     //   console.log(">>> stat", stats);
      
//     //   // console.log(">>> stats", `Name: ${stats.name}, Strength: ${Number(stats.strength)}, Defense: ${Number(stats.defense)}, Rarity: ${Number(stats.rarity)}`);
//     //   // console.log(`NFT #${tokenId}:`);
//     //   // console.log(`  Name: ${stats.name}`);
//     //   // console.log(`  💪 Strength: ${stats.strength}`);
//     //   // console.log(`  🛡️  Defense: ${stats.defense}`);
//     //   // console.log(`  ⭐ Rarity: ${stats.rarity}`);
//     //   // console.log("");
//     // }

//   } catch (error) {
//     console.error("Error purchasing collection:", error);
//   }
// }

// async function setConnectionData() {
//   provider = new ethers.BrowserProvider(window.ethereum!);
//   signer = await provider.getSigner();
//   userAddress = await signer.getAddress();
//   const network = await provider.getNetwork();
//   const chainId = Number(network.chainId);
//   networkName = chainId === 31337 ? "Hardhat Local" : network.name;
// }

// async function createContractInstance(): Promise<Contract> {
//   if (!signer) {
//     throw new Error('No signer available to create contract instance');
//   }
//   return new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signer);
// }

