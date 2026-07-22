// backend/fpfCalculator.js

function getDiscountedPrice(pfa) {
    if (pfa >= 1 && pfa <= 17) {
        return Math.floor(pfa * 0.90); // 10% discount
    } else if (pfa >= 18 && pfa <= 46) {
        return Math.floor(pfa * 0.80); // 20% discount
    } else if (pfa >= 47 && pfa <= 92) {
        return Math.floor(pfa * 0.70); // 30% discount
    } else if (pfa > 92) {
        return Math.floor(pfa * 0.55); // 45% discount
    }
    return pfa;
}

function calculateFpfImpact(currentBalance, option, pfa) {
    if (option === 'PROTEGGI') {
        const discountedPrice = getDiscountedPrice(pfa);
        // "cio che pago va a bilancio in negativo" -> Subtract the discounted price
        return currentBalance - discountedPrice;
    } else if (option === 'VENDI') {
        // "prendo il totale astato che va a bilancio in positivo" -> Add the PFA
        return currentBalance + pfa;
    }
    return currentBalance;
}

function getFpfTierInfo(balance) {
    if (balance >= 0) return { fascia: 1, slot: 30, bonusCasa: 3, bonusTrasferta: 2, label: "Attivo o Pareggio" };
    if (balance >= -100) return { fascia: 2, slot: 29, bonusCasa: 3, bonusTrasferta: 1, label: "Debito Lieve" };
    if (balance >= -200) return { fascia: 3, slot: 28, bonusCasa: 3, bonusTrasferta: 0, label: "Debito Moderato" };
    if (balance >= -300) return { fascia: 4, slot: 27, bonusCasa: 2, bonusTrasferta: 0, label: "Debito Pesante" };
    if (balance >= -400) return { fascia: 5, slot: 26, bonusCasa: 1, bonusTrasferta: 0, label: "Stato di Allarme" };
    if (balance >= -500) return { fascia: 6, slot: 25, bonusCasa: 0, bonusTrasferta: 0, label: "Crisi Aziendale" };
    if (balance >= -600) return { fascia: 7, slot: 24, bonusCasa: 0, bonusTrasferta: 0, label: "Dissesto Finanziario" };
    return { fascia: 8, slot: 23, bonusCasa: 0, bonusTrasferta: 0, label: "Fallimento" };
}

module.exports = {
    getDiscountedPrice,
    calculateFpfImpact,
    getFpfTierInfo
};
