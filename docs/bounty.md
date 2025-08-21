Zama Bounty Program Season 9: Build a privacy-preserving DCA bot July 25, 2025 — The Zama Team The Zama Bounty Program
aims to inspire and incentivize the developer community to build dApps using the Zama Confidential Blockchain Protocol.

Each season, we introduce a new bounty that addresses real-world onchain privacy challenges. With this initiative, we
invite developers to collaborate with us in advancing the FHE ecosystem.

For Season 9, the challenge is to build a privacy-preserving DCA bot with transaction batching using the Zama Protocol,
with a price pool of €10,000.

Important dates Season 9 starting date: July 25, 2025 Season 9 submission deadline: August 25, 2025(23:59, Anywhere On
Earth) Overview In finance, Dollar-Cost Averaging (DCA) is an investment strategy where a market participant invests a
fixed amount of money into a particular asset at regular intervals, regardless of price, to reduce the impact of
volatility and lower the average cost per share over time.

This strategy is also popular in DeFi, where bots can be programmed to execute automated DCA purchases of a token as
long as there are funds available in the wallet.

For example, Balmy and Sushi are well-known DCA bots that are publicly available for DeFi users. These bots execute
automated strategies in liquidity pools across several decentralized exchanges (DEXes).

Unfortunately, DEXes are not private:

Anyone can see the investment strategy of every DCA bot simply by looking at a block explorer. This reveals sensitive
data about assets, wealth, and connected addresses of the owner of the DCA bot. Ideally, the Zama protocol could improve
this experience by hiding the trading strategies of DCA bots operating on liquidity pools. One promising approach is to
add a transaction batching mechanism on top of the DCA bot.

Objective The goal of this bounty is to build a privacy-preserving DCA bot with transaction batching using the Zama
Confidential Blockchain Protocol. This bot will execute automated strategies while maintaining user privacy through a
novel batching mechanism.

Why is batching essential

Traditional DCA bots reveal individual transaction patterns, making users vulnerable to:

Front-running and Maximal Extractable Value (MEV) attacks Portfolio tracking by competitors Wealth profiling and
targeted attacks Furthermore, the obvious approach—wrapping tokens into confidential ERC-20s—does not solve the problem.
While confidential tokens hide balances and transfers within their own contract, the act of wrapping itself is visible
on-chain. Anyone can see how much is being wrapped and when, leaking the user’s DCA strategy in real time. Without
further protection, each wrap and unwrap action exposes the exact amounts the user intends to trade, defeating the
purpose of confidentiality.

Batching solves these issues by aggregating multiple users' DCA orders into a single on-chain transaction, providing
k-anonymity (where k is a fix number of users). When the batch executes, individual strategies remain hidden within the
group, ensuring that:

No single user's purchase amount is revealed Trading patterns are obfuscated The actual swap on the DEX only shows
aggregated amounts Core requirements

1. Batching mechanism

Your solution MUST implement a batching system that:

Collects encrypted DCA intents from multiple users (target: 10 users per batch) Aggregates encrypted amounts using FHE
operations without revealing individual contributions Executes a single decrypted swap on a DEX (e.g., Uniswap on
Sepolia) for the total batch amount. For the sake of simplicity, batching of swaps should only happen in one direction
(USDC → ETH), not bidirectional (USDC→ETH & ETH → USDC). Distributes purchased tokens back to users proportionally using
encrypted calculations Batch execution triggers: Primary: Participants should decide on an appropriate batch size for
users that submit intents for the same trading pair. Fallback: Participants should decide if batches will take place
after a specific amount of time, regardless of how many users submit intents. (eg. 1 block, 5 seconds, etc) 2. Private
DCA strategy features

Users should be able to encrypt parameters such as:

Budget: Total USDC amount to invest (e.g., 5000 USDC) Purchase amounts: How much to buy per interval Timeframe: Total
duration for the DCA strategy (eg. 24 hrs, 1 week, 1 year)s Frequency: assets purchases at fix time intervals [Optional]
Add Dynamic conditions: e.g., "buy the dip: if ETH drops 3%, double the purchase amount for next 5 buys" All these
parameters must remain encrypted and only be processed within the FHE environment.

What we expect A complete application with a clean, clear user experience Correct usage of FHEVM implemented in the
smart contract, effectively protecting private data on the blockchain. A detailed documentation explaining the code
design and a user guide. Tests proving that your solution works as intended Real usage examples and benchmarks when
deployed on the testnet Judging criteria Submissions will be evaluated across several dimensions:

Quality of the code (frontend, contracts, backend) Privacy (how much user information remains confidential) Efficiency &
scalability Coverage of the tests User experience (clarity and smoothness) Decentralization: Is your bot fully
decentralized? Are you relying on decentralized services (e.g., Chainlink Automation) to trigger executions? DEX
integration: Is your solution using a decentralized exchange (e.g., Uniswap) to perform swaps? What, if anything, can an
observer see on-chain? Strategy confidentiality: What information about the user’s strategy is hidden? Is the privacy
configuration flexible?
