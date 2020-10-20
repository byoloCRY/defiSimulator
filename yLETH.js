//Leveraged ETH smart contract in JS

//Structure
// ySC
// Investors
// Simulation

//Simulation rules:
// 1. If ethEnterPrice is between price step, they are invested at their enterPrice
// 2. They exit at their ethExitPrice when it is between price step (can occur in same step as 1)

class ySC{
    constructor(){
        this.investedETH = 0;
        this.totalBorrowedValue = 0; //will accrue due to fees
        this.totalETHExposure = 0;
        this.totalLockedETH = 0;
        this.totalFreeETH = 0;
        this.yELSupply = 0;
        this.listMakerCDP = []; 
    }

    _reCollateralize(price, ratio){
        //moves free eth into collateralization. 
        /*
            Example: 500 DAI from $1000usd worth of ETH for initial CDP
                     ETH is now worth $750. We need to add $250usd more ETH
                     So its totalOwnedValue * 2 - currentLockedETH value = FreeETH to be used * Price
        */
        if(ratio <= .75){
            let usdValueNeed = (this.totalBorrowedValue * 2)- (this.totalLockedETH * price);
            let amountFreeETHNeeded = usdValueNeed / price;
            if(this.totalFreeETH < amountFreeETHNeeded){ //not enough so we just put all our free ETH in
                this.totalLockedETH += this.totalFreeETH;
                this.totalFreeETH = 0;
            }
            else{
                this.totalFreeETH = this.totalFreeETH - amountFreeETHNeeded;
                this.totalLockedETH += amountFreeETHNeeded;
            }
        }
    }

    _addInvestor(price, ratio, usdAmount){
        let ethAmount = usdAmount / price;

        //TODO: something wrong here and also something wrong when value hits entry price multiple times

        //deposit money as freeETH
        this.totalFreeETH += ethAmount;
        //add totalBorrowedValue as .25 of usdAmount
        this.totalBorrowedValue += usdAmount * .25;
        //add to FreeETH the (.25*usdAmount) / price
        this.totalFreeETH += ethAmount * .25;
        this._reCollateralize(price, ratio); //recollateralize previous CDP before adding new investor

    }

    mint(price, usdAmount){
        let ethAmount = usdAmount / price;
        this.investedETH += ethAmount; 
        let poolValue = ((this.totalLockedETH + this.totalFreeETH) * price) - this.totalBorrowedValue;
        if(poolValue === 0){
            this.yELSupply = usdAmount;
            poolValue = usdAmount;
            this.totalLockedETH = ethAmount * .5;
            this.totalFreeETH = ethAmount * .75;
            this.totalBorrowedValue = usdAmount * 0.25;
            this.totalETHExposure = this.totalLockedETH + this.totalFreeETH;
            
            return usdAmount;
        }
        else{
            let lockedEthValue = this.totalLockedETH * price;
            let ratio = lockedEthValue / (this.totalBorrowedValue * 2); //ratio away from 200% collateralization
            
            this._addInvestor(price, ratio, usdAmount);
        }
        //console.log('mint')
        //console.log(price, this.totalLockedETH , this.totalFreeETH, this.totalBorrowedValue, poolValue)
        let amountMinted = (usdAmount / poolValue) * this.yELSupply;
        this.totalETHExposure = this.totalLockedETH + this.totalFreeETH;
        this.yELSupply += amountMinted;
        return amountMinted;
    }


    withdrawal(price, yELAmount){
        let ratio = yELAmount / this.yELSupply;
        
        let withdrawalAmount = (this.totalETHExposure - (this.totalBorrowedValue / price)) * ratio;
        //console.log(withdrawalAmount, ratio, (this.totalBorrowedValue / price), this.totalETHExposure, this.totalFreeETH, this.totalLockedETH)
        if(this.totalFreeETH > withdrawalAmount){
            this.totalFreeETH = this.totalFreeETH - withdrawalAmount;
        }
        else{
            //unwind some position until we have enough
            //  1. sell some eth for dai
            //  2. return dai to unlock eth
            // following is just a simulation of unwinding
            
            let unwindAmount = withdrawalAmount - this.totalFreeETH;
            this.totalLockedETH = this.totalLockedETH - unwindAmount; 
            this.totalFreeETH = 0;
        }
        
        this.yELSupply = this.yELSupply - yELAmount; 
        //remove totalOwnedValue when last withdrawals
        if(this.yELSupply < 0.5){
            this.totalBorrowedValue = this.totalBorrowedValue - this.totalLockedETH * price
            this.totalLockedETH = 0;
        }

        this.totalETHExposure = this.totalFreeETH + this.totalLockedETH;

        this.investedETH -= withdrawalAmount / price;
        withdrawalAmount = this._payFee(withdrawalAmount);
        return withdrawalAmount; //returns eth 
    }

    _payFee(withdrawalAmount){
        //withdraw 0.005 * withdrawalAmount to our treasury address
        return withdrawalAmount * (1 - 0.005); //0.5% withdrawal fee
    }
}
function initInvestor(investors, isSecond){
    investors.push({
        usdAmount: 1000,
        ethEnterPrice: 100,
        ethExitPriceProfit: 105,
        ethExitPriceLoss: 10,
        yEL: null,
        cashOutValue: null,
        cashOutEth: null,
        value: [null]
    });
    investors.push({
        usdAmount: 1000,
        ethEnterPrice: 34,
        ethExitPriceProfit: 105,
        ethExitPriceLoss: 9,
        yEL: null,
        cashOutValue: null,
        cashOutEth: null,
        value: [null]
    });
    investors.push({
        usdAmount: 1000,
        ethEnterPrice: 25,
        ethExitPriceProfit: 105,
        ethExitPriceLoss: 9,
        yEL: null,
        cashOutValue: null,
        cashOutEth: null,
        value: [null]
    });
}

function removeWithdrawalDuplicates(investors){
    for(let b = 0; b < investors.length; b++){
        let investor = investors[b];
        if(investor.cashOutValue !== null){
            for(var i = investor.value.length - 1; i--; i > -1){
                if(investor.value[i] !== investor.cashOutValue){
                    investor.value.splice(i+2, investor.value.length - (i+2));
                    break;
                }
            }
        }
    }
}
function getInvestorValue(investor, ysc, ethPrice){
    let nav = ((ysc.totalLockedETH + ysc.totalFreeETH) * ethPrice) - ysc.totalBorrowedValue;
    
    if(investor.cashOutValue !== null) 
        return investor.cashOutValue;
    if(investor.yEL === null || nav < 0.5)
        return null;
    return  (investor.yEL / ysc.yELSupply) * nav;
}
function random(min, max) {
    return Math.floor(Math.random() * (max - min) ) + min;
}

function randomlyGenerateInvestor(){
    var enterprice = random(10,120);
    var investor = {
        usdAmount: random(100,10000),
        ethEnterPrice: enterprice,
        ethExitPriceProfit: random(enterprice, enterprice*2),
        ethExitPriceLoss: random(enterprice*.1,enterprice),
        yEL: null,
        cashOutValue: null,
        cashOutEth: null
    };
    return investor;
}
function adjustPrice(ethPrice, targetPrice, investors, b){
    if(targetPrice.between(ethPrice[ethPrice.length - 1], ethPrice[ethPrice.length - 2], true)){
        let tempprice = ethPrice[ethPrice.length - 1];
        ethPrice[ethPrice.length - 1] = targetPrice - 1;
        ethPrice.push(targetPrice);
        ethPrice.push(targetPrice + 1);
        ethPrice.push(tempprice);
        if(b !== undefined){
            investors.splice(b,1); //remove element
        }
    }
    return ethPrice;
}

function randomlyGenerateEthPrice(start, percentChange, steps, investor){
    var investors = [...investor]
    var ethPrice = [];
    ethPrice.push(start)
    for(var a = 0; a < steps; a++){
        ethPrice.push(ethPrice[ethPrice.length - 1] * (1 + (percentChange - random(0,percentChange * 2)) * 0.01))
        if(a > 0){
            //add investor's enter and exit price and +1 -1
            for(var b = 0; b < investors.length; b++){
                ethPrice = adjustPrice(ethPrice, investors[b].ethEnterPrice);
                if(investors[b].ethExitPriceLoss.between(ethPrice[ethPrice.length - 1], ethPrice[ethPrice.length - 2], true)){
                    ethPrice = adjustPrice(ethPrice, investors[b].ethExitPriceLoss, investors, b);
                }
                else
                    ethPrice = adjustPrice(ethPrice, investors[b].ethExitPriceProfit, investors, b);
            }
        }
    }
    return ethPrice;
}

Number.prototype.between = function(a, b, inclusive) {
    var min = Math.min(a, b),
      max = Math.max(a, b);
  
    return inclusive ? this >= min && this <= max : this > min && this < max;
  }

//If ethEnterPrice is between price step, they are invested at their enterPrice
function willInvest(investor, price1, price2){
    return investor.yEL === null && investor.cashOutEth === null
        && investor.ethEnterPrice.between(price1, price2, true);
}

//Investor exit at their ethExitPrice when it is between price step (can occur in same step as 1)
function willExit(investor, price1, price2){
    return investor.yEL !== null && investor.cashOutEth === null &&
        (investor.ethExitPriceProfit.between(price1, price2, true) 
        || investor.ethExitPriceLoss.between(price1, price2, true));
}


