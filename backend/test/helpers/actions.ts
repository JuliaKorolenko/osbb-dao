import { type Signer } from "ethers";
import { MIN_VOTING_DURATION } from "./constants.js";
import { ethers } from "./fixtures.js";

/** Mine a single empty block */
const mine = () => ethers.provider.send("evm_mine", []);

/** Fast-forward EVM time and mine a block */
const increaseTime = async (seconds: bigint | number) => {
  await ethers.provider.send("evm_increaseTime", [Number(seconds)]);
  await mine();
};

/** Register residents and self-delegate their tokens */
const setupResidents = async (
  osbbDAO: any,
  governanceToken: any,
  residents: Array<{ signer: Signer; area: bigint | number }>,
) => {
  for (const { signer, area } of residents) {
    const address = await signer.getAddress();

    await osbbDAO.registerResident(address, area);
    await governanceToken.connect(signer).delegate(address);
  }

  await mine();
};

/** Create a proposal and return its id */
const createProposal = async (
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

/** Cast votes from multiple signers */
async function castVotes(
  osbbDAO: any,
  proposalId: bigint,
  votes: Array<{ signer: Signer; support: boolean }>,
) {
  for (const { signer, support } of votes) {
    await osbbDAO.connect(signer).castVote(proposalId, support);
  }
}

export {
  ethers,
  mine,
  increaseTime,
  setupResidents,
  createProposal,
  castVotes,
};
