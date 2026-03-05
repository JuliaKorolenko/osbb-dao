import { network } from "hardhat";
import { AREA_1, AREA_2, AREA_3 } from "./constants.js";
import { createProposal, setupResidents } from "./actions.js";

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

async function deployWithResidentsFixture() {
  const ctx = await deployFixture();

  await setupResidents(ctx.osbbDAO, ctx.governanceToken, [
    { signer: ctx.member1, area: AREA_1 },
    { signer: ctx.member2, area: AREA_2 },
    { signer: ctx.member3, area: AREA_3 },
  ]);

  await ctx.osbbDAO.depositFunds({ value: ethers.parseEther("10") });
  return ctx;
}

async function deployWithProposalFixture() {
  const ctx = await deployWithResidentsFixture();

  await createProposal(ctx.osbbDAO, ctx.member1, {
    executor: await ctx.executor.getAddress(),
    description: "Test Proposal",
  });

  const proposalId = await ctx.osbbDAO.getProposalCount();
  return { ctx, proposalId };
}

type DaoFixture = Awaited<ReturnType<typeof deployFixture>>;

export {
  type DaoFixture,
  ethers,
  deployFixture,
  deployWithResidentsFixture,
  deployWithProposalFixture,
};
