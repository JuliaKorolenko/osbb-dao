// src/main.ts
import './style.css';
import { contractService } from './services/contractService';
import type { ProposalData } from './services/contractService';
import { ethers } from 'ethers';

// Глобальні елементи DOM
let accountSelectorEl: HTMLSelectElement;
let balanceEl: HTMLDivElement;
let residentCountEl: HTMLDivElement;
let totalAreaEl: HTMLDivElement;
let proposalCountEl: HTMLDivElement;
let votingPowerEl: HTMLDivElement;
let userAreaEl: HTMLDivElement;
let proposalsListEl: HTMLDivElement;
let residentsTableEl: HTMLTableSectionElement;
let createAlertEl: HTMLDivElement;
let registerAlertEl: HTMLDivElement;

// Ініціалізація при завантаженні DOM
document.addEventListener('DOMContentLoaded', async () => {
  console.log(">>> DOMContentLoaded event");
  
  // Отримання елементів DOM
  accountSelectorEl = document.getElementById('accountSelector') as HTMLSelectElement;
  balanceEl = document.getElementById('daoBalance') as HTMLDivElement;
  residentCountEl = document.getElementById('residentCount') as HTMLDivElement;
  totalAreaEl = document.getElementById('totalArea') as HTMLDivElement;
  proposalCountEl = document.getElementById('proposalCount') as HTMLDivElement;
  votingPowerEl = document.getElementById('votingPower') as HTMLDivElement;
  userAreaEl = document.getElementById('userArea') as HTMLDivElement;
  proposalsListEl = document.getElementById('proposalsList') as HTMLDivElement;
  residentsTableEl = document.getElementById('residentsTable') as HTMLTableSectionElement;
  createAlertEl = document.getElementById('createAlert') as HTMLDivElement;
  registerAlertEl = document.getElementById('registerAlert') as HTMLDivElement;
  
  // Перевірка наявності елементів
  if (!accountSelectorEl || !balanceEl || !proposalsListEl) {
    console.error(">>> Не знайдено обов'язкові елементи DOM");
    return;
  }
  
  try {
    // Ініціалізація сервісу контрактів
    console.log(">>> Ініціалізація contractService...");
    await contractService.init();
    console.log(">>> contractService ініціалізовано");
    showTab()
    
    // Заповнення списку акаунтів
    loadAccountSelector();
    
    // Завантаження даних дашборду
    await loadDashboard();
    
    // Налаштування обробників подій
    setupEventListeners();
    
    console.log(">>> Ініціалізація завершена");
  } catch (error) {
    console.error(">>> Помилка ініціалізації:", error);
    showAlert(createAlertEl, 'error', '❌ Помилка підключення до Hardhat node. Переконайтесь що node запущено!');
  }
});

function showTab() {
  document.querySelector('.tabs')?.addEventListener('click', (e) => {
    // console.log(">>> target", e.target);
    const curEl = e.target as HTMLDivElement
    const name = curEl.dataset['tab'] ?? ''
    console.log(">>> click", name);

    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('active');
    });

    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.remove('active');
    });

    

    curEl.classList.add('active')
    document.getElementById(name)?.classList.add('active'); 
  })
}

/**
 * Заповнення селектора акаунтів
 */
async function loadAccountSelector() {
  console.log(">>> loadAccountSelector");
  
  const accounts = contractService.getAccounts();
  accountSelectorEl.innerHTML = '';

  // console.log(">>> all accounts", accounts);  

  
  accounts.forEach((address, index) => {
    const option = document.createElement('option');
    option.value = index.toString();
    const shortAddress = `${address.substring(0, 6)}...${address.substring(38)}`;
    option.textContent = `[${index}] ${shortAddress}`;
    accountSelectorEl.appendChild(option);
  });
  
  // Обробник зміни акаунта
  accountSelectorEl.addEventListener('change', async (e) => {
    const index = parseInt((e.target as HTMLSelectElement).value);
    console.log(">>> Зміна акаунта на індекс:", index);    
    
    // const info = await contractService.getResidentInfo(index);
    await contractService.switchAccount(index);
    await loadDashboard();

    // const isResident = (await contractService.getResidentInfo(accounts[index])).isActive;

    // if(isResident) {
    //   await contractService.delegateToken(accounts[index])
    // }
    
  });
}

/**
 * Завантаження дашборду
 */
async function loadDashboard() {
  console.log(">>> loadDashboard");
  
  try {
    const stats = await contractService.getDAOStats();    

    console.log(">>> Статистика отримана:", stats);
    
    // Оновлення статистики
    balanceEl.textContent = `${stats.balance} ETH`;
    residentCountEl.textContent = stats.residents.toString();
    totalAreaEl.textContent = `${stats.totalArea} м²`;
    proposalCountEl.textContent = stats.proposals.toString();
    votingPowerEl.textContent = stats.votingPower;
    userAreaEl.textContent = `${stats.userArea} м²`;
    
    // Завантаження пропозицій
    await loadProposals();
    
    // Завантаження мешканців
    await loadResidents();
  } catch (error) {
    console.error(">>> Помилка loadDashboard:", error);
    showAlert(createAlertEl, 'error', '❌ Помилка завантаження даних');
  }
}

/**
 * Завантаження пропозицій
 */
async function loadProposals() {
  console.log(">>> loadProposals");
  
  try {
    const proposals = await contractService.getProposals();
    console.log(">>> Пропозиції отримані:", proposals);
    
    if (proposals.length === 0) {
      proposalsListEl.innerHTML = '<div class="alert alert-info">📋 Поки що немає пропозицій. Створіть першу!</div>';
      return;
    }
    
    const renderedProposals: string[] = [];
    
    for (const proposal of proposals) {
      try {
        const rendered = await renderProposal(proposal);
        renderedProposals.push(rendered);
      } catch (error) {
        console.error(">>> Помилка рендерингу пропозиції:", proposal.id, error);
        renderedProposals.push(`
          <div class="alert alert-error">
            ❌ Помилка відображення пропозиції #${proposal.id}
          </div>
        `);
      }
    }
    
    proposalsListEl.innerHTML = renderedProposals.join('');
  } catch (error) {
    console.error(">>> Помилка loadProposals:", error);
    proposalsListEl.innerHTML = '<div class="alert alert-error">❌ Помилка завантаження пропозицій</div>';
  }
}

/**
 * Рендер картки пропозиції
 */
async function renderProposal(proposal: ProposalData):  Promise<string> {
  const votesFor = Number(proposal.votesFor);
  const votesAgainst = Number(proposal.votesAgainst);
  const totalVotes = votesFor + votesAgainst;
  const forPercent = totalVotes > 0 ? Math.round((votesFor * 100) / totalVotes) : 0;
  
  // const now = Math.floor(Date.now() / 1000);
  const now = await contractService.getCurrentBlockTime();
  const deadline = Number(proposal.deadline);
  const isActive = now <= deadline && !proposal.executed && !proposal.canceled;

  const executorBalance = await contractService.getAccountBalance(proposal.executor)

  console.log(">>>> now", new Date(now *1000).toLocaleString('uk-UA'));
  
  
  let statusClass = 'status-active';
  let statusText = 'Активна';
  
  if (proposal.executed) {
    statusClass = 'status-passed';
    statusText = 'Виконано';
  } else if (proposal.canceled) {
    statusClass = 'status-rejected';
    statusText = 'Скасовано';
  } else if (now > deadline) {
    statusClass = proposal.succeeded ? 'status-passed' : 'status-rejected';
    statusText = proposal.succeeded ? 'Прийнято' : 'Відхилено';
  }
  
  const deadlineDate = new Date(deadline * 1000).toLocaleString('uk-UA');
  const amountEth = ethers.formatEther(proposal.amount);
  const executorShort = `${proposal.executor.substring(0, 6)}...${proposal.executor.substring(38)}`;

    // ✅ Перевіряємо статус голосування для поточного акаунта
  let canCancel = false;
  const currentAccount = contractService.getCurrentAccount();
  let votingStatus = null;
  let voteInfo = '';

  if (currentAccount) {
    const isAdmin = await contractService.isAdmin(currentAccount);
    const votingActive = now <= deadline;

        // Можно отменить если:
    // 1. Пользователь - админ
    // 2. Не выполнено и не отменено
    // 3. Голосование активно ИЛИ пропозиция не прошла
    canCancel = isAdmin && 
                !proposal.executed && 
                !proposal.canceled && 
                (votingActive || !proposal.succeeded);
  }
  
  if (currentAccount && isActive) {
    try {
      votingStatus = await contractService.getVotingStatus(proposal.id, currentAccount);
      
      if (!votingStatus.canVote && votingStatus.reason) {
        voteInfo = `<div class="alert alert-info" style="margin-top: 10px;">ℹ️ ${votingStatus.reason}</div>`;
      }
    } catch (error) {
      console.error('Помилка перевірки статусу голосування:', error);
    }
  }

  // Визначаємо чи показувати кнопки
  const showVoteButtons = isActive && votingStatus?.canVote;
  
return `
    <div class="proposal-card">
      <div class="proposal-header">
        <div>
          <div class="proposal-title">${escapeHtml(proposal.description)}</div>
        </div>
        <span class="proposal-status ${statusClass}">${statusText}</span>
      </div>
      
      <div class="proposal-amount">${amountEth} ETH</div>
      
      <div style="margin-bottom: 15px; color: #666;">
        <div><strong>👷 Виконавець:</strong> ${executorShort}</div>
        <div><strong>⏰ Дедлайн:</strong> ${deadlineDate}</div>
      </div>
      
      <div class="vote-progress">
        <div class="vote-stats">
          <span><strong>За:</strong> ${votesFor} (${forPercent}%)</span>
          <span><strong>Проти:</strong> ${votesAgainst} (${100-forPercent}%)</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${forPercent}%"></div>
        </div>
      </div>
      
      ${voteInfo}
      
      ${showVoteButtons ? `
        <div class="vote-buttons">
          <button class="btn btn-vote-for" data-proposal-id="${proposal.id}" data-support="true">✓ Голосувати ЗА</button>
          <button class="btn btn-vote-against" data-proposal-id="${proposal.id}" data-support="false">✗ Голосувати ПРОТИ</button>
        </div>
      ` : ''}
      
      ${!proposal.executed && !proposal.canceled && now > deadline && proposal.succeeded ? `
        <button class="btn btn-primary" style="width: 100%; margin-top: 10px;" data-execute-id="${proposal.id}">
          🔨 Виконати та переказати ${amountEth} ETH
        </button>
      ` : ''}
      
      ${proposal.executed ? `
        <div class="alert alert-success" style="margin-top: 10px;">
          ✅ Виконано! Кошти переказано виконавцю.
            Баланс виконавця до: ${executorBalance} ETH,
        </div>
      ` : ''}

      ${canCancel ? `
        <button 
          class="btn btn-danger" 
          style="width: 100%; margin-top: 10px;" 
          data-cancel-id="${proposal.id}"
        >
          🚫 Скасувати пропозицію (Адмін)
        </button>
      ` : ''}
    </div>
  `;
}

/**
 * Завантаження мешканців
 */
async function loadResidents() {
  console.log(">>> loadResidents");
  const curAccount = contractService.getCurrentAccount()
  let isCurAccountAdmin = null

  if(curAccount) {
    isCurAccountAdmin = await contractService.isAdmin(curAccount)
  }
  
  try {
    const accounts = contractService.getAccounts();
    const rows: string[] = [];
    
    for (const address of accounts.slice(0, 10)) {
      try {
        const info = await contractService.getResidentInfo(address);
        
        if (info.isActive) {
          const isAdmin = await contractService.isAdmin(address);
          const shortAddress = `${address.substring(0, 6)}...${address.substring(38)}`;
          const roleClass = isAdmin ? 'role-admin' : 'role-resident';
          const roleText = isAdmin ? '⭐ Адмін' : 'Мешканець';
          
          rows.push(`
            <tr>
              <td><code>${shortAddress}</code></td>
              <td>${info.apartmentArea.toString()} м²</td>
              <td><strong>${info.votingPower.toString()} токенів</strong></td>
              <td><span class="role-badge ${roleClass}">${roleText}</span></td>
              <td>
                <button
                  data-action="deleteResident"
                  data-id="${address}"
                  class="btn btn-delete"
                  ${!isCurAccountAdmin || isAdmin ? 'disabled' : ''}
                >
                  Видалити
                </button>
              </td>
            </tr>
          `);
        }
      } catch (e) {
        // Акаунт не зареєстрований
      }
    }
    
    residentsTableEl.innerHTML = rows.length > 0 
      ? rows.join('') 
      : '<tr><td colspan="4">Немає зареєстрованих мешканців</td></tr>';
  } catch (error) {
    console.error(">>> Помилка loadResidents:", error);
  }
}

/**
 * Налаштування обробників подій
 */
function setupEventListeners() {
  console.log(">>> setupEventListeners");
  
  // Делегування подій для кнопок голосування та виконання
  document.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    
    // Голосування
    if (target.classList.contains('btn-vote-for') || target.classList.contains('btn-vote-against')) {
      const proposalId = parseInt(target.dataset.proposalId || '0');
      const support = target.dataset.support === 'true';
      await handleVote(proposalId, support);
    }
    
    // Виконання
    if (target.dataset.executeId) {
      const proposalId = parseInt(target.dataset.executeId);
      await handleExecuteProposal(proposalId);
    }

    if(target.classList.contains('btn-delete')) {
      console.log(">>> click", target.dataset.id);
      const curAddress = target.dataset.id;

      if(curAddress) {
        await handleDeleteResident(curAddress)
      }
    }

    // ✅ Обробник скасування
    if (target.dataset.cancelId) {
      const proposalId = parseInt(target.dataset.cancelId);
      await handleCancelProposal(proposalId);
    }
    
    if(target.dataset.devAction) {
      await handleDevAction(target)
    }

    // Оновлюємо час при переході на вкладку Dev Tools
    document.querySelector('[data-tab="devTools"]')?.addEventListener('click', updateBlockTime);
  });
  
  // Створення пропозиції
  const createBtn = document.querySelector('[data-action="createProposal"]');
  if (createBtn) {
    createBtn.addEventListener('click', handleCreateProposal);
  }
  
  // Реєстрація мешканця
  const registerBtn = document.querySelector('[data-action="registerResident"]');
  if (registerBtn) {
    registerBtn.addEventListener('click', handleRegisterResident);
  }
  
  // Підписка на події контракту
  contractService.onProposalCreated((id, desc, amount) => {
    console.log(">>> 🔔 Нова пропозиція:", id, desc);
    loadProposals();
  });
  
  contractService.onVoteCast((voter, id, support) => {
    console.log(">>> 🔔 Новий голос:", voter, id, support);
    loadProposals();
  });
}

/**
 * Обробник голосування
 */
async function handleVote(proposalId: number, support: boolean) {
  console.log(">>> handleVote:", proposalId, support);
  
  try {
    showAlert(createAlertEl, 'info', '⏳ Голосування...');
    
    const tx = await contractService.castVote(proposalId, support);
    await contractService.waitForTransaction(tx);
    
    showAlert(createAlertEl, 'success', `✅ Ви проголосували ${support ? 'ЗА' : 'ПРОТИ'}!`);
    
    await loadProposals();
  } catch (error: any) {
    console.error(">>> Помилка handleVote:", error);
    showAlert(createAlertEl, 'error', `❌ Помилка: ${error.message || error}`);
  }
}

/**
 * Обробник виконання пропозиції
 */
async function handleExecuteProposal(proposalId: number) {
  console.log(">>> handleExecuteProposal:", proposalId);
  
  try {
    const proposals = await contractService.getProposals();
    const proposal = proposals.find(p => p.id === proposalId);
    
    if (!proposal) return;
    
    const amountEth = ethers.formatEther(proposal.amount);
    const executorShort = `${proposal.executor.substring(0, 6)}...${proposal.executor.substring(38)}`;
    
    if (!confirm(`🔨 Виконати пропозицію?\n\n💰 Сума: ${amountEth} ETH\n👷 Виконавець: ${executorShort}`)) {
      return;
    }
    
    showAlert(createAlertEl, 'info', '⏳ Виконання пропозиції...');
    
    const tx = await contractService.executeProposal(proposalId);
    await contractService.waitForTransaction(tx);
    
    showAlert(createAlertEl, 'success', '✅ Пропозиція виконана! Кошти переказано.');
    
    await loadDashboard();
  } catch (error: any) {
    console.error(">>> Помилка handleExecuteProposal:", error);
    showAlert(createAlertEl, 'error', `❌ Помилка: ${error.message || error}`);
  }
}

/**
 * Обробник створення пропозиції
 */
async function handleCreateProposal() {
  console.log(">>> handleCreateProposal");
  
  try {
    const titleEl = document.getElementById('proposalTitle') as HTMLInputElement;
    const descriptionEl = document.getElementById('proposalDescription') as HTMLTextAreaElement;
    const amountEl = document.getElementById('proposalAmount') as HTMLInputElement;
    const executorSelectEl = document.getElementById('proposalExecutor') as HTMLSelectElement;
    const executorCustomEl = document.getElementById('proposalExecutorCustom') as HTMLInputElement;
    const durationEl = document.getElementById('proposalDuration') as HTMLInputElement;
    
    const title = titleEl.value;
    const description = descriptionEl.value;
    const amount = amountEl.value;
    const executorSelect = executorSelectEl.value;
    const executorCustom = executorCustomEl.value;
    const duration = durationEl.value;
    
    const executor = executorCustom || executorSelect;
    
    if (!title || !description || !amount || !executor || !duration) {
      showAlert(createAlertEl, 'error', '❌ Заповніть всі поля!');
      return;
    }
    
    if (!ethers.isAddress(executor)) {
      showAlert(createAlertEl, 'error', '❌ Невірна адреса виконавця!');
      return;
    }
    
    showAlert(createAlertEl, 'info', '⏳ Створення пропозиції...');
    
    const tx = await contractService.createProposal(
      `${title}: ${description}`,
      amount,
      executor,
      parseInt(duration)
    );
    
    await contractService.waitForTransaction(tx);
    
    showAlert(createAlertEl, 'success', '✅ Пропозиція успішно створена!');
    
    // Очистити форму
    titleEl.value = '';
    descriptionEl.value = '';
    amountEl.value = '';
    executorSelectEl.value = '';
    executorCustomEl.value = '';
    
    await loadDashboard();
  } catch (error: any) {
    console.error(">>> Помилка handleCreateProposal:", error);
    showAlert(createAlertEl, 'error', `❌ Помилка: ${error.message || error}`);
  }
}

/**
 * Обробник реєстрації мешканця
 */
async function handleRegisterResident() {
  console.log(">>> handleRegisterResident");
  
  try {
    const addressEl = document.getElementById('residentAddress') as HTMLInputElement;
    const areaEl = document.getElementById('residentArea') as HTMLInputElement;
    
    const address = addressEl.value;
    const area = areaEl.value;

    const curAccount = contractService.getCurrentAccount()
    let isAdmin = null

    if(curAccount) {
      isAdmin = await contractService.isAdmin(curAccount)
    }

    if(!isAdmin) {
      showAlert(registerAlertEl, 'error', '❌ Тільки адміністратор може додавати нових мешканців');
      return;
    }
    
    if (!address || !area) {
      showAlert(registerAlertEl, 'error', '❌ Заповніть всі поля!');
      return;
    }
    
    if (!ethers.isAddress(address)) {
      showAlert(registerAlertEl, 'error', '❌ Невірна адреса!');
      return;
    }
    
    showAlert(registerAlertEl, 'info', '⏳ Реєстрація мешканця...');
    
    const tx = await contractService.registerResident(address, parseInt(area));
    await contractService.waitForTransaction(tx);

    await contractService.delegateToken(address)
    
    showAlert(registerAlertEl, 'success', '✅ Мешканець зареєстрований!');
    
    addressEl.value = '';
    areaEl.value = '';
    
    await loadDashboard();
  } catch (error: any) {
    console.error(">>> Помилка handleRegisterResident:", error);
    showAlert(registerAlertEl, 'error', `❌ Помилка: ${error.message || error}`);
  }
}


async function handleDeleteResident(address: string) {
  try {
    showAlert(registerAlertEl, 'info', '⏳ Видалення мешканця...');
    
    const tx = await contractService.removeCurResident(address);

    await contractService.waitForTransaction(tx);
    
    showAlert(registerAlertEl, 'success', '✅ Мешканець видалений!');
    await loadDashboard();

  } catch(error: any) {
    console.error(">>> Помилка handleDeleteResident:", error);
    showAlert(registerAlertEl, 'error', `❌ Помилка: ${error.message || error}`);
  }
  
}

async function handleCancelProposal(proposalId: number) {
  console.log(">>> handleCancelProposal:", proposalId);
  
  try {
    const proposals = await contractService.getProposals();
    const proposal = proposals.find(p => p.id === proposalId);
    
    if (!proposal) return;
    
    if (!confirm(`🚫 Скасувати пропозицію?\n\n"${proposal.description}"`)) {
      return;
    }
    
    showAlert(createAlertEl, 'info', '⏳ Скасування пропозиції...');
    
    const tx = await contractService.cancelProposal(proposalId);
    await contractService.waitForTransaction(tx);
    
    showAlert(createAlertEl, 'success', '✅ Пропозиція скасована!');
    
    await loadProposals();
  } catch (error: any) {
    console.error(">>> Помилка handleCancelProposal:", error);
    showAlert(createAlertEl, 'error', `❌ Помилка: ${error.message || error}`);
  }
}

/**
 * Оновити відображення поточного часу блокчейна
 */
async function updateBlockTime() {
  const blockTimeEl = document.getElementById('currentBlockTime');
  if (!blockTimeEl) return;
  
  try {
    const timestamp = await contractService.getCurrentBlockTime();
    const date = new Date(timestamp * 1000);
    
    blockTimeEl.innerHTML = `
      <strong>Timestamp:</strong> ${timestamp}<br>
      <strong>Дата:</strong> ${date.toLocaleString('uk-UA')}<br>
      <strong>Unix:</strong> ${timestamp}
    `;
  } catch (error) {
    blockTimeEl.textContent = '❌ Помилка отримання часу';
  }
}

/**
 * Обробник dev actions
 */
async function handleDevAction(target: HTMLElement) {
  const action = target.dataset.devAction;
  
  try {
    switch (action) {
      case 'time': {
        const seconds = parseInt(target.dataset.seconds || '0');
        showAlert(createAlertEl, 'info', `⏳ Перемотка часу на ${seconds / 3600} годин...`);
        
        await contractService.increaseTime(seconds);
        
        showAlert(createAlertEl, 'success', `✅ Час перемотано на ${seconds / 3600} годин!`);
        await updateBlockTime();
        await loadProposals();
        break;
      }
      
      case 'toDeadline': {
        const proposalIdEl = document.getElementById('devProposalId') as HTMLInputElement;
        const proposalId = parseInt(proposalIdEl.value);
        
        if (!proposalId) {
          showAlert(createAlertEl, 'error', '❌ Введіть ID пропозиції');
          return;
        }
        
        showAlert(createAlertEl, 'info', '⏳ Перемотка до дедлайну...');
        await contractService.fastForwardToDeadline(proposalId, 0);
        
        showAlert(createAlertEl, 'success', '✅ Час перемотано до дедлайну!');
        await updateBlockTime();
        await loadProposals();
        break;
      }
      
      case 'pastDeadline': {
        const proposalIdEl = document.getElementById('devProposalId') as HTMLInputElement;
        const proposalId = parseInt(proposalIdEl.value);
        
        if (!proposalId) {
          showAlert(createAlertEl, 'error', '❌ Введіть ID пропозиції');
          return;
        }
        
        showAlert(createAlertEl, 'info', '⏳ Перемотка після дедлайну...');
        await contractService.fastForwardToDeadline(proposalId, 3600); // +1 година
        
        showAlert(createAlertEl, 'success', '✅ Час перемотано за дедлайн (+1 год)!');
        await updateBlockTime();
        await loadProposals();
        break;
      }
      
      case 'refreshTime': {
        await updateBlockTime();
        showAlert(createAlertEl, 'success', '✅ Час оновлено!');
        break;
      }
    }
  } catch (error: any) {
    console.error('Помилка dev action:', error);
    showAlert(createAlertEl, 'error', `❌ Помилка: ${error.message}`);
  }
}

/**
 * Показати алерт
 */
function showAlert(element: HTMLElement, type: 'info' | 'success' | 'error', message: string) {
  const className = type === 'error' ? 'alert-error' : type === 'success' ? 'alert-success' : 'alert-info';
  element.innerHTML = `<div class="alert ${className}">${message}</div>`;
  
  if (type === 'success') {
    setTimeout(() => {
      element.innerHTML = '';
    }, 5000);
  }
}

/**
 * Екранування HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}