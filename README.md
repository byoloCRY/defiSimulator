# defiSimulator

This is a simulator for this [proposal-creating-a-leverage-eth-product-for-yfi](https://gov.yearn.finance/t/proposal-creating-a-leverage-eth-product-for-yfi/7017/15) but can be used for future project ideas.

To see it, just **click** [here](https://byolocry.github.io/defiSimulator)

To visualize, just open the html in your browser. To play with the simulation, just change the js file.

Summary:

Create a 1.25x leveraged ETH product

Abstract:

Should this proposal be implemented, a 1.25x leveraged ETH product will be created. The redemption fees generated will be used to reward YFI staked in governance.

Motivation:

YFI needs more products to generate fees as yields for vaults are low in the current environment. This is a family of new products that will make YFI great again.

Specification:

Here is a high level of how this would work. (Detailed example below)

User deposits ETH into a yearn smart contract (ySC)

ySC mints yETHLeverage tokens (yEL) and gives it to user. (the amount minted is {[price of ETH * quantity of deposited ETH] / total amount of value in the pool} * number of yEL in circulation )

ySC takes half of the deposited ETH and borrows DAI from MakerDAO’s SC creating a CDP with 200% collateralization. (every 100 ETH would gets you 50ETH worth of DAI) Also keeping the other half ETH as is for redemptions and to add to collateral when ETH price decreases. This results in a 1.25x leverage ratio. 0.5*1.5 + 0.5 = 0.75 + 0.5 = 1.25

ySC takes the DAI and buys ETH from a marketplace (Uniswap or somewhere else)

When another user deposits, ySC checks the price of ETH and recalculate the internal price of yEL to reflect changes in ETH with a 1.25x multipler. This is done simply by [total amount of value in the pool / number of yEL outstanding].

As price of ETH decreases, ySC will re-collateralize with the free ETH whenever the collateralization ratio drops below 175% until there are no more free ETH. This can be calculated whenever a user deposits. ySC can calculate the price of ETH for the future re-collateralization points until liquidation. (See liquidation example)

User redeems their yEL tokens. They would get back [number of yEL redeemed / total yEL outstanding] * pool NAV in ETH. There should be some ETH available, or else we close our CDP with Maker to get more ETH unlocked.

The general process begins with user depositing ETH into the smart contract. Then the smart contract mints yETHLeverage (yEL) tokens and gives it to the user. The yEL token represent a percentage claim of the total value of the “fund” which we will call pool here. So 1 yEL with 100 yEL outstanding would represent a 1% of the total value (NAV) of the pool. The pool only holds ETH. It uses DAI only to buy ETH or to close CDP and is never held.

Since MakerDAO CDP requires a minimum of 150% collateralization, I decided to create this as a 1.25x leverage product. With less collateralization or cheaper ways of getting leverage, we can make a higher levered product.

The internal price of yEL is only needed to be calculated when users deposit and withdraw ETH from ySC.

When there is only one depositor, yEL would be worth 0 when the price drops 80% and thus closing the CPD and the pool would have 0 value. However, when someone else deposits, a new leveraged position would be opened at another price point. As long as there are a user buying in at a lower price than before, yEL will maintain a positive value.

The investor buying in at a lower price “rescues” the original investor. The original investor can have a negative value position relative to when he bought it, but still maintain equity in the pool. In return, the rescuer gets more leveraged exposure to ETH cheaply. There is a strong incentive to buy in at a low price because of this cheap leverage.

Lastly, as price drops, previous investors shares of the pool are diluted by new investors, thus new investors’ capital gain more leverage. This is another reason why 1.25x leverage is preferred to 1.5x because there is a .25 margin to maintain the leverage in the events of a significant price decline.

Below is an example and some breakdowns.



In the example, Investor 1 invests $1000 worth of ETH at $100 per ETH. The price drops to 15 then recovers. Investor 2 invests $1000 worth of ETH at $34 per ETH. Investor 2 rescues Investor 1 from liquidation when the price hits $20. However, when price goes back to $100 per ETH, Investor 1 only has $659 instead of his original $1000 in investments. The Investor 2’s share is worth $3767. Investor 2 has 36.76ETH of exposure. So he has $3676 of exposure. We then subtract the $250 for the loan, we get $3426. $3767 - $3426 = $340 which is the benefit to Investor 2 for being the rescuer. If we add $340 + $659 which is Investor 1’s share, we would get $1000(1 off due to rounding).

The following is a liquidation scenario.



In the top above scenario, Investor 1 invests $1000 USD worth of ETH at $100/ETH. So his breakdown in the ySC is 7.5 ETH and 5 ETH locked as collateral in the CDP. In this model, I re-collateralized the CDP to 200% whenever price falls 25%. So when ETH is $75, we now have 6.66667 ETH locked as collateral and 5.83333ETH as free ETH.

When price hits $20, we have to liquidate because all of our 12.5ETH are in CDP as collateral and our collateralization ratio is 150%. So we are liquidated.

In our second scenario, Investor 2 comes to the rescue at $25/ETH. He invests $1000 USD worth so that is 40ETH. First thing ySC does is re-collateralizes Investor 1’s CDP to 200%. Then it also takes 20ETH and collateralize it and buy ETH with the DAI proceeds.

The free ETH including the leverage, after the rescue is 22.5ETH and locked is 40ETH for a total of 62.5ETH of exposure. At $8/ETH the 62.5ETH is now worth $500 so that means since all of it is in the CDP, we are at 150% collateralization. (8 * 62.5 = 500. We borrowed $250+$250). At this point investor 1 & 2 needs another rescuer.

If this product is successful, it can spawn a family of leveraged products for different tokens
