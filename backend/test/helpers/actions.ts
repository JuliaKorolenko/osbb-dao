import { type Signer } from "ethers";
import { network } from "hardhat";
import { MIN_VOTING_DURATION } from "./constants.js";

const { ethers } = await network.connect();

/** Mine a single empty block */
export const mine = () => ethers.provider.send("evm_mine", []);

/** Fast-forward EVM time and mine a block */
export const increaseTime = async (seconds: bigint | number) => {
  await ethers.provider.send("evm_increaseTime", [Number(seconds)]);
  await mine();
};

/** Register residents and self-delegate their tokens */
export const registerResidents = async (
  osbbDAO: any,
  residents: Array<{ signer: Signer; area: bigint | number }>,
) => {
  for (const { signer, area } of residents) {
    const address = await signer.getAddress();
    await osbbDAO.registerResident(address, area);
  }

  await mine();
};

/** Create a proposal and return its id */
export const createProposal = async (
  osbbDAO: any,
  proposer: Signer,
  opts: {
    description?: string;
    amount?: bigint;
    executor: string;
    duration?: bigint;
  },
): Promise<{ id: bigint; tx: any }> => {
  const id = (await osbbDAO.getProposalCount()) + 1n;

  const args = {
    description: opts.description ?? "Test Proposal",
    amount: opts.amount ?? ethers.parseEther("1"),
    executor: opts.executor,
    duration: opts.duration ?? MIN_VOTING_DURATION,
  };

  return osbbDAO
    .connect(proposer)
    .createProposal(
      args.description,
      args.amount,
      args.executor,
      args.duration,
    );

  // const tx = await osbbDAO
  //   .connect(proposer)
  //   .createProposal(
  //     args.description,
  //     args.amount,
  //     args.executor,
  //     args.duration,
  //   );
  // await mine();
  // return { id, tx };
};
