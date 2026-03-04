import { network } from "hardhat";
const { ethers } = await network.connect();

async function deployFixture() {
  const [owner, member1, member2, member3, executor] =
    await ethers.getSigners();

  const OSSB_DAOFactory = await ethers.getContractFactory("OSBB_DAO");
  const osbbDAO = await OSSB_DAOFactory.deploy();
  await osbbDAO.waitForDeployment();
  const tokenAddress = await osbbDAO.governanceToken();
  const governanceToken = await ethers.getContractAt(
    "OSBB_Token",
    tokenAddress,
  );

  return {
    osbbDAO,
    governanceToken,
    owner,
    member1,
    member2,
    member3,
    executor,
  };
}

type DaoFixture = Awaited<ReturnType<typeof deployFixture>>;

export { type DaoFixture, ethers, deployFixture };
