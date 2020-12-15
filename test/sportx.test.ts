import { expect } from "chai";
import { Wallet } from "ethers";
import { JsonRpcProvider } from "ethers/providers";
import { parseUnits } from "ethers/utils";
import "mocha";
import moment from "moment";
import { INewOrder, IPendingBetsRequest } from "../src";
import {
  DEFAULT_MATIC_RPL_URLS,
  Environments,
  TOKEN_ADDRESSES,
  Tokens
} from "../src/constants";
import { ISportX, newSportX } from "../src/sportx";
import {
  convertFromAPIPercentageOdds,
  convertToAPIPercentageOdds,
  convertToTrueTokenAmount
} from "../src/utils/convert";
import { getSidechainNetwork } from "../src/utils/networks";

// tslint:disable no-string-literal

const TEST_MNEMONIC =
  "elegant execute say gain evil afford puppy upon amateur planet lunar pen";

if (!process.env.ENVIRONMENT) {
  throw new Error(`ENVIRONMENT env var not defined`);
}
if (!process.env.MAINCHAIN_PROVIDER_URL) {
  throw new Error(`MAINCHAIN_PROVIDER_URL env var not defined`);
}

const testMarketHash =
  "0xd6f8c2aa9da1a332cf77aa7c870ff53e2a37e0008e3fdfd4d307a426214247c0"; // CHANGE THIS TO MATCH A REAL MARKET

describe("sportx", () => {
  let sportX: ISportX;
  const env: Environments = process.env.ENVIRONMENT as Environments;
  const provider = new JsonRpcProvider(DEFAULT_MATIC_RPL_URLS[env]);
  const wallet = Wallet.fromMnemonic(TEST_MNEMONIC).connect(provider);

  before("should initialize", async () => {
    sportX = await newSportX(
      env,
      wallet.privateKey,
      process.env.MAINCHAIN_PROVIDER_URL
    );
    await sportX.approveSportXContracts(
      TOKEN_ADDRESSES[getSidechainNetwork(env)][Tokens.DAI]
    );
  });

  it("should get metadata", async () => {
    const metadata = await sportX.getMetadata();
    expect(metadata.executorAddress).to.exist;
  });

  it("should lookup markets", async () => {
    const activeMarkets = await sportX.getActiveMarkets();
    const markets = await sportX.marketLookup([activeMarkets[0].marketHash]);
    expect(markets.length).equal(1);
  });

  it("should get leagues", async () => {
    const leagues = await sportX.getLeagues();
    expect(leagues.length).greaterThan(0);
  });

  it("should get sports", async () => {
    const sports = await sportX.getSports();
    expect(sports.length).greaterThan(0);
  });

  it("should get active markets", async () => {
    const activeMarkets = await sportX.getActiveMarkets();
    expect(activeMarkets.length).greaterThan(0);
  });

  it("should make a new order", async () => {
    const newOrder: INewOrder = {
      marketHash: testMarketHash,
      totalBetSize: convertToTrueTokenAmount(10).toString(),
      percentageOdds: convertToAPIPercentageOdds(0.5).toString(),
      expiry: moment()
        .add(1, "hour")
        .unix(),
      isMakerBettingOutcomeOne: true,
      baseToken: TOKEN_ADDRESSES[getSidechainNetwork(env)][Tokens.DAI]
    };
    const response = await sportX.newOrder(newOrder);
    expect(response.status).to.equal("success");
  });

  it("should cancel an order", async () => {
    const newOrder: INewOrder = {
      marketHash: testMarketHash,
      totalBetSize: parseUnits("10", 18).toString(),
      percentageOdds: convertToAPIPercentageOdds(0.5).toString(),
      expiry: moment()
        .add(1, "hour")
        .unix(),
      isMakerBettingOutcomeOne: true,
      baseToken: TOKEN_ADDRESSES[getSidechainNetwork(env)][Tokens.DAI]
    };
    const {
      data: { orders }
    } = await sportX.newOrder(newOrder);
    const response = await sportX.cancelOrder(orders, "Cancel Orders");
    expect(response.status).to.equal("success");
  });

  it("should convert from protocol percentage odds", () => {
    const odds = "88985727650227679586";
    const convertedOdds = convertFromAPIPercentageOdds(odds);
    expect(convertedOdds).to.equal(0.8898572765022768);
  });

  it("should get active orders for an address", async () => {
    const orders = await sportX.getOrders([testMarketHash]);
    const maker = orders[0].maker;
    const activeOrders = await sportX.getOrders(undefined, maker);
    expect(Object.keys(activeOrders).length).greaterThan(0);
  });

  it("should get active orders for a market", async () => {
    const orders = await sportX.getOrders([testMarketHash]);
    expect(orders.length).greaterThan(0);
  });

  it("should suggest orders", async () => {
    const suggestions = await sportX.suggestOrders(
      testMarketHash,
      convertToTrueTokenAmount(10),
      false,
      wallet.address,
      TOKEN_ADDRESSES[getSidechainNetwork(env)][Tokens.DAI]
    );
    expect(suggestions.status).to.equal("success");
  });

  it("should get pending bets", async () => {
    const payload: IPendingBetsRequest = {
      bettor: wallet.address
    };
    const result = await sportX.getPendingOrFailedBets(payload);
  });

  it("should get trades", async () => {
    const trades = await sportX.getTrades({});
    expect(trades.length).greaterThan(0);
  });

  it("should fill an order", async () => {
    const orders = await sportX.getOrders([testMarketHash]);
    const suggestions = await sportX.suggestOrders(
      testMarketHash,
      convertToTrueTokenAmount(10),
      true,
      wallet.address,
      TOKEN_ADDRESSES[getSidechainNetwork(env)][Tokens.DAI]
    );
    const ordersToFill = orders.filter(order =>
      suggestions.data.orderHashes.includes(order.orderHash)
    );
    const fill = await sportX.fillOrders(ordersToFill, [
      convertToTrueTokenAmount(10)
    ]);
    expect(fill.status).to.equal("success");
  });
});
