//Leveraged ETH smart contract in JS

//Structure
// ySC
// Investors
// Simulation

//Simulation rules:
// 1. If ethEnterPrice is between price step, they are invested at their enterPrice
// 2. They exit at their ethExitPrice when it is between price step (can occur in same step as 1)

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

function randomlyGenerateEthPrice(start, percentChange, steps){
    var ethPrice = [];
    ethPrice.push(start)
    for(var a = 0; a < steps; a++){
        ethPrice.push(ethPrice[ethPrice.length - 1] * (100 + percentChange - random(0,percentChange * 2)) * 0.01)
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

class ySC{
    constructor(){
        this.totalOwedValue = 0;
        this.totalETHExposure = 0;
        this.totalLockedETH = 0;
        this.totalFreeETH = 0;
        this.yELSupply = 0;
        this.listMakerCDP = [];
    }

    _reCollateralize(price, ratio){
        if(ratio <= .75){
            this.totalLockedETH = (this.totalOwedValue * 2)/ price; //200% collateralization
            this.totalFreeETH = this.totalETHExposure - this.totalLockedETH;
            if(this.totalFreeETH < 0)
                this.totalFreeETH = 0;
        }
    }

    _addInvestor(price, ratio, usdAmount){
        let ethAmount = usdAmount / price;
        if(this.totalFreeETH === 0 && ratio < 0.75){
            this.totalLockedETH = (this.totalOwedValue * 2) / price; //200% collateralization
            this.totalETHExposure += ethAmount * 1.25;
            this.totalFreeETH = this.totalETHExposure - this.totalLockedETH;
            if(this.totalFreeETH < 0)
                this.totalFreeETH = 0;

            if(this.totalFreeETH > ethAmount * 0.5){
                this.totalOwedValue += ethAmount * 0.25 * price;
                this.totalFreeETH -= ethAmount * 0.5; //this line is the only line that is different from below code block
                this.totalLockedETH += ethAmount * 0.5;
                this.totalETHExposure = this.totalFreeETH + this.totalLockedETH;
            }
            else{
                this.totalOwedValue += this.totalFreeETH * price * 0.5;
                this.totalLockedETH += this.totalFreeETH;
                this.totalFreeETH = this.totalFreeETH * 0.5;
            }
            //console.log(this.totalFreeETH , this.totalETHExposure , this.totalLockedETH)
        }
        else{

            if(this.totalFreeETH > ethAmount * 0.5){
                this.totalOwedValue += ethAmount * 0.25 * price;
                this.totalFreeETH -= ethAmount * 0.25; //by locking 0.5 * eth, we get back 0.25 eth
                this.totalLockedETH += ethAmount * 0.5;
                this.totalETHExposure = this.totalFreeETH + this.totalLockedETH;
            }
            else{
                this.totalOwedValue += this.totalFreeETH * price * 0.5;
                this.totalLockedETH += this.totalFreeETH;
                this.totalFreeETH = this.totalFreeETH * 0.5;
            }
        }
    }

    mint(price, usdAmount){
        let ethAmount = usdAmount / price;

        let poolValue = ((this.totalLockedETH + this.totalFreeETH) * price) - this.totalOwedValue;
        if(poolValue === 0){
            this.yELSupply = usdAmount;
            poolValue = usdAmount;
            this.totalLockedETH = ethAmount * .5;
            this.totalFreeETH = ethAmount * .75;
            this.totalOwedValue = usdAmount * 0.25;
            this.totalETHExposure = this.totalLockedETH + this.totalFreeETH;
            return usdAmount;
        }
        else{
            let lockedEthValue = this.totalLockedETH * price;
            let ratio = lockedEthValue / (this.totalOwedValue * 2); //ratio away from 200% collateralization
            this._reCollateralize(price, ratio); //recollateralize previous CDP before adding new investor
            this._addInvestor(price, ratio, usdAmount);
        }
        console.log('line 135')
        console.log(price, this.totalLockedETH , this.totalFreeETH, this.totalOwedValue, poolValue)
        let amountMinted = (usdAmount / poolValue) * this.yELSupply;
        this.yELSupply += amountMinted;
        return amountMinted;
    }


    withdrawal(price, yELAmount){
        let ratio = yELAmount / this.yELSupply;
        
        let withdrawalAmount = (this.totalETHExposure - (this.totalOwedValue / price)) * ratio;
        //console.log(withdrawalAmount, ratio, (this.totalOwedValue / price), this.totalETHExposure, this.totalFreeETH, this.totalLockedETH)
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
        this.totalETHExposure = this.totalFreeETH + this.totalLockedETH;
        this.yELSupply = this.yELSupply - yELAmount; 
        withdrawalAmount = this._payFee(withdrawalAmount);
        return withdrawalAmount; //returns eth 
    }

    _payFee(withdrawalAmount){
        //withdraw 0.005 * withdrawalAmount to our treasury address
        return withdrawalAmount * (1 - 0.005); //0.5% withdrawal fee
    }
}

function runSimulation(){
    var investors = [];
    var ethPrice = [110,104,75,50,34,30,20,110];
    investors.push({
        usdAmount: 1000,
        ethEnterPrice: 100,
        ethExitPriceProfit: 105,
        ethExitPriceLoss: 10,
        yEL: null,
        cashOutValue: null,
        cashOutEth: null
    });
    investors.push({
        usdAmount: 1000,
        ethEnterPrice: 34,
        ethExitPriceProfit: 105,
        ethExitPriceLoss: 9,
        yEL: null,
        cashOutValue: null,
        cashOutEth: null
    });
    investors.push({
        usdAmount: 1000,
        ethEnterPrice: 25,
        ethExitPriceProfit: 105,
        ethExitPriceLoss: 9,
        yEL: null,
        cashOutValue: null,
        cashOutEth: null
    });
    //var ethPrice = randomlyGenerateEthPrice(100, 50, 10);

    //for(let a = 0; a < 5; a++){
        //investors.push(randomlyGenerateInvestor());
    //}
    //console.log(investors)
    //console.log(ethPrice)

    let ysc = new ySC();

    for(let a = 1; a < ethPrice.length; a++){
        for(let b = 0; b < investors.length; b++){
            //investor invests 
            let investor = investors[b];

            if( willInvest(investor, ethPrice[a], ethPrice[a-1]) ){
                investor.yEL = ysc.mint(investor.ethEnterPrice, investor.usdAmount);
                console.log(b, investor.usdAmount,investor.ethEnterPrice, ysc, ethPrice[a], ethPrice[a-1], investor.yEL)
                
            }

            //investor exit
            if( willExit(investor, ethPrice[a], ethPrice[a-1]) ){
                console.log(investor.yEL)
                if(investor.ethExitPriceLoss.between(ethPrice[a], ethPrice[a-1], true)){
                    investor.cashOutEth = ysc.withdrawal(investor.ethExitPriceLoss, investor.yEL);
                    investor.cashOutValue = investor.cashOutEth * investor.ethExitPriceLoss;
                    console.log(b, investor.cashOutEth, investor.cashOutValue, investor.ethExitPriceLoss, ethPrice[a], ethPrice[a-1])
                }
                    
                else{
                    investor.cashOutEth = ysc.withdrawal(investor.ethExitPriceProfit, investor.yEL);
                    investor.cashOutValue = investor.cashOutEth * investor.ethExitPriceProfit;
                    console.log(b, investor.cashOutEth, investor.cashOutValue, investor.ethExitPriceProfit, ethPrice[a], ethPrice[a-1])
                }

            }
        }
    }
}

runSimulation();

