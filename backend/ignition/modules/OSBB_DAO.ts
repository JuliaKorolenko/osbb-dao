
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

module.exports = buildModule("OSBB_DAO_Module", (m) => {
  
  const osbbAdmin = m.getAccount(0);
  
  // Інші акаунти - мешканці (опційно)
  const resident1 = m.getAccount(1);
  const resident2 = m.getAccount(2);
  const resident3 = m.getAccount(3);
  
  // ========== ДЕПЛОЙ DAO ==========
  // Конструктор автоматично надає osbbAdmin роль ADMIN_ROLE
  const osbbDAO = m.contract("OSBB_DAO", []);
  
// ========== РЕЄСТРАЦІЯ МЕШКАНЦІВ ==========
  // Реєструємо самого адміна як мешканця з квартирою 100 м²
  m.call(osbbDAO, "registerResident", [osbbAdmin, 100], {
    id: "register_admin",
    from: osbbAdmin, // Викликає адмін
  });
  
  // Реєструємо інших мешканців (опційно)
  m.call(osbbDAO, "registerResident", [resident1, 50], {
    id: "register_resident1",
    from: osbbAdmin,
  });
  
  m.call(osbbDAO, "registerResident", [resident2, 75], {
    id: "register_resident2",
    from: osbbAdmin,
  });
  
  m.call(osbbDAO, "registerResident", [resident3, 60], {
    id: "register_resident3",
    from: osbbAdmin,
  });

  // ========== ПОПОВНЕННЯ ФОНДУ (опційно) ==========
  // Додаємо початкові кошти у фонд ОСББ (10 ETH)
  m.call(osbbDAO, "depositFunds", [], {
    id: "initial_deposit",
    value: BigInt(10n * 10n**18n), // 10 ETH
    from: osbbAdmin,
  });
  
  return { osbbDAO };
});