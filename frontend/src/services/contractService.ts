// src/services/contractService.ts
import { ethers, Contract } from 'ethers';
import type { 
  BrowserProvider, 
  JsonRpcProvider,
  TransactionResponse,
  TransactionReceipt 
} from 'ethers';

import OSSB_DAO from '../contracts/OSBB_DAO.json'
import OSSB_Token from '../contracts/OSBB_TOKEN.json';

// Типи даних
export interface ProposalData {
  id: number;
  description: string;
  amount: bigint;
  executor: string;
  deadline: bigint;
  votesFor: bigint;
  votesAgainst: bigint;
  executed: boolean;
  canceled: boolean;
  succeeded: boolean;
}

export interface ResidentInfo {
  apartmentArea: bigint;
  votingPower: bigint;
  isActive: boolean;
}

type ResidentData = {
  address: string;
  apartmentArea: number;
  residentAddress: string;
  isActive: boolean;
};

export interface DAOStats {
  balance: string;
  residents: number;
  totalArea: number;
  proposals: number;
  votingPower: string;
  userArea: number;
}

// Конфігурація
const CONFIG = {
  RPC_URL: import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545',
  DAO_ADDRESS: import.meta.env.VITE_DAO_ADDRESS || '',
  CHAIN_ID: 31337, // Hardhat local
};

// Клас для роботи з контрактами
class ContractService {
  private provider: JsonRpcProvider | null = null;
  private daoContract: Contract | null = null;
  private tokenContract: Contract | null = null;
  private currentAccount: string | null = null;
  private accounts: any[] = [];

  /**
   * Ініціалізація підключення до Hardhat node
   */
  async init(): Promise<void> {
    try {
      console.log('🔄 Підключення до Hardhat node...');
      
      // Підключення до локального node
      this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      
      // Перевірка підключення
      const network = await this.provider.getNetwork();
      console.log('✅ Підключено до мережі:', network.chainId);
      
      // Отримання акаунтів
      this.accounts = await this.provider.listAccounts();
      // const allAccounts = await this.provider.listAccounts()
      console.log('✅ Знайдено акаунтів:', this.accounts.length);
      
      if (this.accounts.length === 0) {
        throw new Error('Не знайдено акаунтів');
      }
      
      // Вибір першого акаунта за замовчуванням
      this.currentAccount = this.accounts[0].address;
      
      // Підключення до контрактів
      await this.connectToContracts();

      try {
        console.log('🔄 Перевірка делегації існуючих резидентів...');
        await this.delegateAllResidents();
        console.log('✅ Делегація завершена');
      } catch (delegateError) {
        // Не критична помилка - продовжуємо роботу
        console.warn('⚠️ Помилка делегації (не критично):', delegateError);
      }
      
      console.log('✅ Ініціалізація завершена');
    } catch (error) {
      console.error('❌ Помилка ініціалізації:', error);
      throw error;
    }
  }

  /**
   * Підключення до контрактів
   */
  private async connectToContracts(): Promise<void> {
    let signer = null;
    if (!this.provider) throw new Error('Provider не ініціалізовано');
    if (!CONFIG.DAO_ADDRESS) throw new Error('Адреса DAO не вказана');
    
    // Отримуємо signer для поточного акаунта
    if(this.currentAccount) {
      signer = await this.provider.getSigner(this.currentAccount);
      
    }    
    // Підключаємось до DAO
    this.daoContract = new ethers.Contract(CONFIG.DAO_ADDRESS, OSSB_DAO.abi, signer);
    console.log('✅ Підключено до DAO:', CONFIG.DAO_ADDRESS);
    
    // Отримуємо адресу токена
    const tokenAddress = await this.daoContract.getGovernanceToken();
    this.tokenContract = new Contract(tokenAddress, OSSB_Token.abi, this.provider);
    console.log('✅ Підключено до Token:', tokenAddress);
  }

  /**
   * Отримати список акаунтів
   */
  getAccounts(): string[] {
    return this.accounts.map(el => el.address);
  }

  /**
   * Отримати поточний акаунт
   */
  getCurrentAccount(): string | null {
    return this.currentAccount;
  }

  /**
   * Змінити поточний акаунт
   */
  async switchAccount(accountIndex: number): Promise<void> {
    if (accountIndex < 0 || accountIndex >= this.accounts.length) {
      throw new Error('Невірний індекс акаунта');
    }
    
    this.currentAccount = this.accounts[accountIndex].address;
    
    // Перепідключаємось до контрактів з новим signer
    await this.connectToContracts();
    
    console.log('🔄 Змінено акаунт на:', this.currentAccount);
  }

  /**
   * Отримати статистику DAO
   */
  async getDAOStats(): Promise<DAOStats> {
    if (!this.daoContract || !this.currentAccount) {
      throw new Error('Контракти не ініціалізовані');
    }

    const [balance, residents, totalArea, proposals, votingPower, residentInfo] = await Promise.all([
      this.daoContract.getBalance(),
      this.daoContract.getResidentCount(),
      this.daoContract.totalArea(),
      this.daoContract.getProposalCount(),
      this.daoContract.getVotingPower(this.currentAccount),
      this.daoContract.getResidentInfo(this.currentAccount),
    ]);

    console.log(">>> residentInfo", residentInfo);
    

    return {
      balance: ethers.formatEther(balance),
      residents: Number(residents),
      totalArea: Number(totalArea),
      proposals: Number(proposals),
      votingPower: votingPower.toString(),
      userArea: Number(residentInfo.apartmentArea),
    };
  }

  /**
   * Отримати список пропозицій
   */
  async getProposals(): Promise<ProposalData[]> {
    if (!this.daoContract) throw new Error('DAO не ініціалізовано');

    
    const count = await this.daoContract.getProposalCount();    
    const proposals: ProposalData[] = [];   
    
    for (let i = 1; i <= Number(count); i++) {
      
      const proposal = await this.daoContract.getProposal(i);
      proposals.push({
        id: i,
        description: proposal.description,
        amount: proposal.amount,
        executor: proposal.executor,
        deadline: proposal.deadline,
        votesFor: proposal.votesFor,
        votesAgainst: proposal.votesAgainst,
        executed: proposal.executed,
        canceled: proposal.canceled,
        succeeded: proposal.succeeded
      });
    }

    return proposals;
  }

  /**
   * Створити пропозицію
   */
  async createProposal(
    description: string,
    amountEth: string,
    executor: string,
    durationDays: number
  ): Promise<TransactionResponse> {
    if (!this.daoContract) throw new Error('DAO не ініціалізовано');

    const amountWei = ethers.parseEther(amountEth);
    const durationSeconds = durationDays * 24 * 60 * 60;

    const tx = await this.daoContract.createProposal(
      description,
      amountWei,
      executor,
      durationSeconds
    );

    console.log('📝 Створення пропозиції, tx:', tx.hash);
    return tx;
  }

  /**
   * Проголосувати
   */
  async castVote(proposalId: number, support: boolean): Promise<TransactionResponse> {
    if (!this.daoContract) throw new Error('DAO не ініціалізовано');

    const tx = await this.daoContract.castVote(proposalId, support);
    console.log('🗳️ Голосування, tx:', tx.hash);
    return tx;
  }

  /**
   * Виконати пропозицію
   */
  async executeProposal(proposalId: number): Promise<TransactionResponse> {
    if (!this.daoContract) throw new Error('DAO не ініціалізовано');

    const tx = await this.daoContract.executeProposal(proposalId);
    console.log('🔨 Виконання пропозиції, tx:', tx.hash);
    return tx;
  }

  /**
   * Зареєструвати мешканця
   */
  async registerResident(address: string, area: number): Promise<TransactionResponse> {
    if (!this.daoContract) throw new Error('DAO не ініціалізовано');

    const tx = await this.daoContract.registerResident(address, area);
    console.log('✅ Реєстрація мешканця, tx:', tx.hash);
    return tx;
  }


  async removeCurResident(address: string) {
    if (!this.daoContract) throw new Error('DAO не ініціалізовано');

    const tx = await this.daoContract.removeResident(address);
    console.log('✅ Видалення мешканця, tx:', tx.hash);
    return tx;
  }

  /**
   * Поповнити фонд
   */
  async depositFunds(amountEth: string): Promise<TransactionResponse> {
    if (!this.daoContract) throw new Error('DAO не ініціалізовано');

    const amountWei = ethers.parseEther(amountEth);
    const tx = await this.daoContract.depositFunds({ value: amountWei });
    console.log('💰 Поповнення фонду, tx:', tx.hash);
    return tx;
  }

  /**
   * Отримати інформацію про мешканця
   */
  async getResidentInfo(address: string): Promise<ResidentInfo> {
    if (!this.daoContract) throw new Error('DAO не ініціалізовано');    

    const info = await this.daoContract.getResidentInfo(address);
    return {
      apartmentArea: info.apartmentArea,
      votingPower: info.votingPower,
      isActive: info.isActive,
    };
  }

  /**
   * Перевірити чи є адреса адміністратором
   */
  async isAdmin(address: string): Promise<boolean> {
    if (!this.daoContract) throw new Error('DAO не ініціалізовано');

    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ADMIN_ROLE'));
    return await this.daoContract.hasRole(ADMIN_ROLE, address);
  }

  /**
   * Отримати баланс акаунта в ETH
   */
  async getAccountBalance(address: string): Promise<string> {
    if (!this.provider) throw new Error('Provider не ініціалізовано');

    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  /**
   * Очікування підтвердження транзакції
   */
  async waitForTransaction(tx: TransactionResponse): Promise<TransactionReceipt | null> {
    console.log('⏳ Очікування підтвердження...');
    const receipt = await tx.wait();
    console.log('✅ Транзакція підтверджена!');
    return receipt;
  }

  /**
   * Делегування токена для можливості голосування
   */

  async delegateToken(address: string) {
    if (!this.tokenContract) throw new Error('Token Contract не ініціалізовано');
    let signer = await this.provider?.getSigner(address);
    const contract = this.tokenContract as any;
    const tx = await contract.connect(signer).delegate(address);
    await tx.wait();
    console.log(`Токены делегированы на ${address}`);
  }

/**
 * Делегувати токени для всіх активних резидентів
 */
  async delegateAllResidents(): Promise<void> {
    const residents = await this.getAllResidents();
    
    for (const resident of residents.filter(r => r.isActive)) {
      try {
        const delegate = await this.tokenContract!.delegates(resident.address);
        
        if (delegate === ethers.ZeroAddress) {
          console.log(`🔄 Делегування для ${resident.address}...`);
          await this.delegateToken(resident.address);
        } else {
          console.log(`✓ Вже делеговано: ${resident.address}`);
        }
      } catch (error) {
        console.error(`❌ Помилка для ${resident.address}:`, error);
      }
    }
    
    console.log('✅ Делегація завершена для всіх резидентів');
  }

  /**
   * Отримати всіх резидентів
   */
  async getAllResidents(): Promise<ResidentData[]> {
    if (!this.daoContract) throw new Error('DAO не ініціалізовано');
    const residentsArray: ResidentData[] = [];

    // Сначала получаем количество жителей
    const countBN: bigint = await this.daoContract.getResidentCount();
    const count = Number(countBN);

    for (let i = 0; i < count; i++) {
      // Берём адрес жителя из residentList
      const addr: string = await this.daoContract.residentList(i);

      // Берём данные жителя из mapping
      const resident = await this.daoContract.residents(addr);
      // resident = [apartmentArea, residentAddress, isActive] если это сгенерированный getter

      residentsArray.push({
        address: addr,
        apartmentArea: Number(resident[0]),
        residentAddress: resident[1],
        isActive: resident[2],
      });
    }

    return residentsArray;
 }

 /**
 * Перевірити чи проголосував резидент за пропозицію
 */
  async hasVoted(proposalId: number, voterAddress: string): Promise<boolean> {
    if (!this.daoContract) throw new Error('DAO не ініціалізовано');
    
    try {
      return await this.daoContract.isVoted(proposalId, voterAddress);
    } catch (error) {
      console.error('Помилка перевірки голосування:', error);
      return false;
    }
  }

  /**
 * Отримати інформацію про голос
 */
  async getVoteReceipt(proposalId: number, voterAddress: string): Promise<{
    hasVoted: boolean;
    support: boolean;
    votes: bigint;
  }> {
    if (!this.daoContract) throw new Error('DAO не ініціалізовано');
    
    try {
      const receipt = await this.daoContract.getVoteReceipt(proposalId, voterAddress);
      return {
        hasVoted: receipt.hasVoted,
        support: receipt.support,
        votes: receipt.votes
      };
    } catch (error) {
      console.error('Помилка отримання vote receipt:', error);
      return {
        hasVoted: false,
        support: false,
        votes: BigInt(0)
      };
    }
  }

  /**
 * Отримати повну інформацію про можливість голосувати
 */
  async getVotingStatus(proposalId: number, voterAddress: string): Promise<{
    isResident: boolean;
    hasVotingPower: boolean;
    hasVoted: boolean;
    voteSupport?: boolean;
    canVote: boolean;
    reason?: string;
  }> {
    if (!this.daoContract || !this.tokenContract) {
      throw new Error('Контракти не ініціалізовані');
    }

    try {
      // Перевіряємо чи є резидентом
      const residentInfo = await this.daoContract.getResidentInfo(voterAddress);
      const isResident = residentInfo.isActive;

      if (!isResident) {
        return {
          isResident: false,
          hasVotingPower: false,
          hasVoted: false,
          canVote: false,
          reason: 'Не є зареєстрованим резидентом'
        };
      }

      // Перевіряємо чи вже проголосував
      const voteReceipt = await this.getVoteReceipt(proposalId, voterAddress);
      
      if (voteReceipt.hasVoted) {
        return {
          isResident: true,
          hasVotingPower: true,
          hasVoted: true,
          voteSupport: voteReceipt.support,
          canVote: false,
          reason: `Вже проголосували ${voteReceipt.support ? 'ЗА' : 'ПРОТИ'}`
        };
      }

      // Перевіряємо чи є право голосу
      const proposal = await this.daoContract.getProposal(proposalId);
      const votes = await this.tokenContract.getPastVotes(voterAddress, proposal.snapshotId);
      const hasVotingPower = votes > 0;      

      if (!hasVotingPower) {
        return {
          isResident: true,
          hasVotingPower: false,
          hasVoted: false,
          canVote: false,
          reason: 'Токени не делеговані до створення пропозиції'
        };
      }

      // Перевіряємо чи пропозиція активна
      const now = Math.floor(Date.now() / 1000);
      const deadline = Number(proposal.deadline);
      
      if (now > deadline) {
        return {
          isResident: true,
          hasVotingPower: true,
          hasVoted: false,
          canVote: false,
          reason: 'Термін голосування закінчився'
        };
      }

      if (proposal.executed) {
        return {
          isResident: true,
          hasVotingPower: true,
          hasVoted: false,
          canVote: false,
          reason: 'Пропозиція вже виконана'
        };
      }

      if (proposal.canceled) {
        return {
          isResident: true,
          hasVotingPower: true,
          hasVoted: false,
          canVote: false,
          reason: 'Пропозиція скасована'
        };
      }

      return {
        isResident: true,
        hasVotingPower: true,
        hasVoted: false,
        canVote: true
      };

    } catch (error) {
      console.error('Помилка getVotingStatus:', error);
      return {
        isResident: false,
        hasVotingPower: false,
        hasVoted: false,
        canVote: false,
        reason: 'Помилка перевірки статусу'
      };
    }
  }

  /**
 * Скасувати пропозицію (тільки адмін)
 */
  async cancelProposal(proposalId: number): Promise<TransactionResponse> {
    if (!this.daoContract) throw new Error('DAO не ініціалізовано');

    const tx = await this.daoContract.cancelProposal(proposalId);
    console.log('🚫 Скасування пропозиції, tx:', tx.hash);
    return tx;
  }

/**
 * Перемотка времени в Hardhat Network (только для разработки!)
 * @param seconds Кількість секунд для перемотки вперед
 */
  async increaseTime(seconds: number): Promise<void> {
    if (!this.provider) throw new Error('Provider не ініціалізовано');
    
    try {
      // Увеличиваем время
      await this.provider.send('evm_increaseTime', [seconds]);
      // Майним новый блок чтобы применить изменения
      await this.provider.send('evm_mine', []);
      
      console.log(`⏰ Час перемотано на ${seconds} секунд (${seconds / 3600} годин)`);
    } catch (error) {
      console.error('Помилка перемотки часу:', error);
      throw error;
    }
  }

/**
 * Установить конкретное время (timestamp)
 */
  async setNextBlockTimestamp(timestamp: number): Promise<void> {
    if (!this.provider) throw new Error('Provider не ініціалізовано');
    
    try {
      await this.provider.send('evm_setNextBlockTimestamp', [timestamp]);
      await this.provider.send('evm_mine', []);
      
      console.log(`⏰ Наступний блок матиме timestamp: ${new Date(timestamp * 1000)}`);
    } catch (error) {
      console.error('Помилка встановлення часу:', error);
      throw error;
    }
  }

/**
 * Отримати поточний час блокчейна
 */
  async getCurrentBlockTime(): Promise<number> {
    if (!this.provider) throw new Error('Provider не ініціалізовано');
    
    const blockNumber = await this.provider.getBlockNumber();
    const block = await this.provider.getBlock(blockNumber);
    
    if (!block) throw new Error('Не вдалося отримати блок');
    
    return block.timestamp;
  }

/**
 * Перемотати час до закінчення голосування пропозиції
 */
  async fastForwardToDeadline(proposalId: number, extraSeconds: number = 0): Promise<void> {
    if (!this.daoContract) throw new Error('DAO не ініціалізовано');
    
    const proposal = await this.daoContract.getProposal(proposalId);
    const deadline = Number(proposal.deadline);
    const currentTime = await this.getCurrentBlockTime();
    
    const secondsToAdd = deadline - currentTime + extraSeconds;
    
    if (secondsToAdd > 0) {
      await this.increaseTime(secondsToAdd);
      console.log(`⏰ Перемотано до дедлайну пропозиції #${proposalId}`);
    } else {
      console.log(`⏰ Дедлайн пропозиції #${proposalId} вже минув`);
    }
  }

  /**
   * Підписка на події
   */
  onProposalCreated(callback: (proposalId: number, description: string, amount: bigint) => void): void {
    if (!this.daoContract) return;

    this.daoContract.on('ProposalCreated', (proposalId, proposer, description, amount) => {
      callback(Number(proposalId), description, amount);
    });
  }

  onVoteCast(callback: (voter: string, proposalId: number, support: boolean) => void): void {
    if (!this.daoContract) return;

    this.daoContract.on('VoteCast', (voter, proposalId, support) => {
      callback(voter, Number(proposalId), support);
    });
  }

  /**
   * Відписка від подій
   */
  removeAllListeners(): void {
    if (this.daoContract) {
      this.daoContract.removeAllListeners();
    }
  }
}

// Експорт singleton instance
export const contractService = new ContractService();
export default contractService;