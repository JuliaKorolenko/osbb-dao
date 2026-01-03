import './style.css'
// import './wallet';
// import './services/contractService'
import { contractService} from './services/contractService'

// const CONTRACT_ADDRESS = import.meta.env.CONTRACT_ADDRESS;

// console.log(">>> address", CONTRACT_ADDRESS);

document.addEventListener('DOMContentLoaded', async () => {
  console.log(">>> DOMContentLoaded event");
  const selectorEl = document.getElementById('accountSelector');
  const balanceEl = document.getElementById('daoBalance') as HTMLDivElement
  const residentCountEl = document.getElementById('residentCount') as HTMLDivElement // Кількість мешканців
  const totalAreaEl = document.getElementById('totalArea') as HTMLDivElement // Загальна площа
  const proposalCountEl = document.getElementById('proposalCount') as HTMLDivElement // Кількість пропозицій
  const votingPowerEl = document.getElementById('votingPower') as HTMLDivElement // Voting power поточного користувача
  const userAreaEl = document.getElementById('userArea') as HTMLDivElement // // Площа квартири

  const proposalContainerEl = document.getElementById('proposalsList') as HTMLDivElement 
  // const tabs = document.getElementsByClassName('tab') as HTMLCollectionOf<HTMLDivElement>
  // const tabContainer = document.getElementById('tabs') as HTMLDivElement


  await contractService.init()

  // const proposals = await contractService.getProposals()
  // console.log(">>> proposals", proposals);

  // switchAccount


  await loadDashboard()
  showTab()

  selectorEl?.addEventListener('change', async (e) => {
    console.log(">>> select");
    const target = e.target as HTMLSelectElement;

    let res = await contractService.switchAccount(+target.value)

    
  })
  
  // document.querySelector('#accountSelector')?.addEventListener('change')


  document.getElementById('createProposal')?.addEventListener('click', async () => {
    // console.log(">>> click");
    await createProposalHandler()
    
  })

  const curAccount = contractService.getCurrentAccount()

  console.log(">>> curAccount", curAccount);
  

  const allAccounts = contractService.getAccounts()
  // console.log(">>> acc", allAccounts);
  

  for (let i = 0; i < allAccounts.length; i++) {
    const option = document.createElement('option');
    option.value = `${i}`; // ← Зберігаємо ІНДЕКС, не адресу
    const shortAddress = allAccounts[i].substring(0, 6) + '...' + allAccounts[i].substring(38);
    
    if(curAccount===allAccounts[i]) {
      option.textContent = `* [${i}] ${shortAddress}`;
    }
    else {
      option.textContent = `[${i}] ${shortAddress}`;
    }

    selectorEl?.appendChild(option);
  }

  async function loadDashboard() {
    try {
      // Баланс DAO
      const { balance, proposals, residents, totalArea, userArea, votingPower } = await contractService.getDAOStats();
      
      balanceEl.textContent = `${balance} ETH`
      residentCountEl.textContent = `${residents}`
      totalAreaEl.textContent = `${totalArea} м² загальна площа`
      proposalCountEl.textContent = `${proposals}`
      votingPowerEl.textContent = `${votingPower}`
      userAreaEl.textContent = `${userArea} м² квартира`

      
      // // Завантаження пропозицій
      // await loadProposals();
      
      
      // // Завантаження мешканців
      // await loadResidents();

    }
    catch(e) {
      console.error("Помилка завантаження:", e);
    }
  }

  // Завантаження пропозицій
  async function loadProposals() {
    try {
      const proposals = await contractService.getProposals()       
      console.log(">>>+++ proposals", proposals);

      if(!proposals.length) {
        proposalContainerEl.innerHTML = '<div class="alert alert-info">📋 Поки що немає пропозицій. Створіть першу!</div>';
        return
      }
      else {
        console.log(">>> proposals else", proposals);
        return proposals
      }
      
    } catch(e) {
      console.log(">>> get prop error", e);
    }
  }
  

          // const count = await daoContract.getProposalCount();
          // 
          // if (count.toNumber() === 0) {
          //     container.innerHTML = '<div class="alert alert-info">📋 Поки що немає пропозицій. Створіть першу!</div>';
          //     return;
          // }
          
          // container.innerHTML = '';
          
          // for (let i = 1; i <= count.toNumber(); i++) {
          //     const proposal = await daoContract.getProposal(i);
              
          //     const totalVotes = proposal.votesFor.add(proposal.votesAgainst);
          //     const forPercent = totalVotes.gt(0) ? proposal.votesFor.mul(100).div(totalVotes).toNumber() : 0;
              
          //     const now = Math.floor(Date.now() / 1000);
          //     const isActive = now <= proposal.deadline.toNumber() && !proposal.executed && !proposal.canceled;
              
          //     let statusClass, statusText;
          //     if (proposal.executed) {
          //         statusClass = 'status-passed';
          //         statusText = 'Виконано';
          //     } else if (proposal.canceled) {
          //         statusClass = 'status-rejected';
          //         statusText = 'Скасовано';
          //     } else if (now > proposal.deadline.toNumber()) {
          //         statusClass = proposal.succeeded ? 'status-passed' : 'status-rejected';
          //         statusText = proposal.succeeded ? 'Прийнято' : 'Відхилено';
          //     } else {
          //         statusClass = 'status-active';
          //         statusText = 'Активна';
          //     }
              
          //     const deadline = new Date(proposal.deadline.toNumber() * 1000);
  // }

  function showTab() {
    document.querySelector('.tabs')?.addEventListener('click', (e) => {
      // console.log(">>> target", e.target);
      const curEl = e.target as HTMLDivElement
      const name = curEl.dataset['name'] ?? ''

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

  async function createProposalHandler() {
    try {
      let res = await contractService.createProposal('test', '0.5', '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', 7)
      await loadProposals()

      console.log(">>> createProposal", res);
      

    } catch(e) {
      console.log(">>> createProposal error", e);
      

    }
  }

  // const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement;

  // function showTab(tabName) {
  //     // // Hide all sections
  //     // document.querySelectorAll('.content-section').forEach(section => {
  //     //     section.classList.remove('active');
  //     // });
      
  //     // // Remove active class from all tabs
  //     // document.querySelectorAll('.tab').forEach(tab => {
  //     //     tab.classList.remove('active');
  //     // });
      
  //     // // Show selected section
  //     // document.getElementById(tabName).classList.add('active');
      
  //     // // Add active class to clicked tab
  //     // event.target.classList.add('active');
  // }
});


