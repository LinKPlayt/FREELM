// Quiz reels: "True or false?" questions with a countdown, then the answer and why. Viewers play along,
// comment their score and watch to the end, which is what short-video apps reward.
//
// The questions are written by hand and checked, so a quiz never says something false without
// correcting it straight away: a "false" statement is always followed by "False!" and the facts.

export const QUIZ = {
  "personal finance": [
    ["Paying only the minimum on a credit card can keep you in debt for years.", true, "Minimum payments mostly cover interest, so the balance shrinks very slowly."],
    ["Checking your own credit report lowers your credit score.", false, "Checking your own report is a soft inquiry, so it doesn't affect your score at all."],
    ["Most experts suggest an emergency fund of three to six months of expenses.", true, "That's enough to cover a job loss or a big surprise bill without borrowing."],
    ["Closing your oldest credit card always raises your credit score.", false, "It can lower it, because it shortens your credit history and raises how much of your limit you use."],
    ["Using a debit card helps build your credit score.", false, "Debit card spending isn't reported to the credit bureaus, so it doesn't build credit."],
    ["The 50/30/20 rule puts 20 percent of your take-home pay toward savings and paying off debt.", true, "Fifty percent goes to needs, thirty to wants, and twenty to your future."],
    ["Money in a savings account at an FDIC-insured bank is protected up to $250,000 per depositor, per bank, for each account category.", true, "If the bank fails, that insurance pays you back, up to the limit."],
    ["Payment history is one of the biggest factors in most credit scores.", true, "Paying every bill on time does more for your score than almost anything else."],
    ["A credit card's APR is the yearly interest rate on balances you don't pay off.", true, "Pay the full statement balance each month and you usually pay no interest at all."],
    ["Your salary is part of your credit score.", false, "Credit scores come from your borrowing history, not your income, though lenders may ask about income separately."],
    ["Automating a transfer to savings on payday makes it easier to save consistently.", true, "Money that never sits in your checking account is money you're less likely to spend."],
  ],
  investing: [
    ["An index fund tries to beat the market by picking the best stocks.", false, "An index fund simply tracks a market index, like the S&P 500, instead of picking winners."],
    ["A fund's expense ratio is charged every year you hold it.", true, "It's taken out of the fund each year, so even small fees add up over decades."],
    ["By the Rule of 72, money growing at 8 percent a year doubles in about 9 years.", true, "Divide 72 by the yearly return: 72 divided by 8 is 9."],
    ["Owning many different stocks removes all investment risk.", false, "Diversifying lowers the risk of one company sinking you, but the whole market can still fall."],
    ["A company's dividend is guaranteed.", false, "Companies can cut or stop their dividends at any time, especially in hard years."],
    ["Qualified withdrawals from a Roth IRA in retirement are tax-free.", true, "You pay tax on the money going in, so it can come out tax-free later if you follow the rules."],
    ["An employer 401(k) match is extra money you miss out on if you don't contribute enough.", true, "If your employer matches, contributing at least enough to get the full match is like an instant return."],
    ["Over long periods, most actively managed stock funds fail to beat their index.", true, "Research on fund performance has shown this again and again, often because of higher fees."],
    ["Investing a fixed amount on a regular schedule is called dollar-cost averaging.", true, "You buy more shares when prices are low and fewer when they're high."],
    ["Bonds can never lose value.", false, "Bond prices can fall, especially when interest rates rise or the issuer runs into trouble."],
    ["Past performance guarantees future returns.", false, "A fund that did well before can do badly next, which is why every fund document warns about it."],
  ],
  crypto: [
    ["Bitcoin's total supply is capped at 21 million coins.", true, "The limit is built into Bitcoin's code, and new coins are released more slowly over time."],
    ["Crypto held on an exchange is insured by the FDIC like a bank account.", false, "FDIC insurance covers bank deposits, not crypto, so if an exchange fails your coins aren't covered."],
    ["If you lose the recovery phrase to your own wallet, the company that made the wallet can always reset it.", false, "With self-custody, only the recovery phrase can restore your wallet. Lose it and the coins are usually gone for good."],
    ["A stablecoin is designed to keep a steady value, usually one US dollar.", true, "It's only as stable as whatever backs it, and some have lost their peg."],
    ["A crypto transfer sent to the wrong address can usually be reversed by the network.", false, "Blockchain transfers are generally final, so always double-check the address before you send."],
    ["Bitcoin and Ethereum run on the same blockchain.", false, "They're separate networks, each with its own coin, rules and software."],
    ["Crypto prices can move more than 10 percent in a single day.", true, "Swings that size are common in crypto and rare for large, established stocks."],
    ["A crypto wallet stores the actual coins inside your phone.", false, "The coins are recorded on the blockchain; a wallet holds the keys that let you move them."],
    ["Anyone who asks for your recovery phrase is probably trying to steal your crypto.", true, "No real exchange or support team needs it. Never share it with anyone."],
  ],
  economy: [
    ["Inflation means the same amount of money buys less than it used to.", true, "When prices rise across the economy, each dollar stretches less far."],
    ["When the Federal Reserve raises interest rates, borrowing usually gets more expensive.", true, "Higher rates flow through to credit cards, car loans and mortgages."],
    ["In the US, a recession is declared the moment the stock market falls.", false, "A committee of economists dates US recessions using jobs, income, spending and output, not stock prices."],
    ["GDP measures the total value of the goods and services an economy produces.", true, "It's the most common way to measure how big an economy is and whether it's growing."],
    ["Falling prices across the whole economy are always good news.", false, "Widespread falling prices, called deflation, can lead people to delay spending, which can hurt jobs and wages."],
    ["A tariff is a tax on imported goods.", true, "It's paid when the goods come into the country, and the cost is often passed on to buyers."],
    ["The unemployment rate counts everyone who doesn't have a job.", false, "It counts people without a job who are actively looking for one. People not looking aren't counted."],
    ["When inflation is higher than your savings rate, your savings lose buying power.", true, "If prices rise faster than your interest, the same money buys less each year."],
    ["A strong US dollar makes imported goods cheaper for Americans.", true, "Each dollar buys more abroad, though it makes US exports pricier for other countries."],
  ],
  "side hustles": [
    ["In the US, side hustle income is taxable even if you don't get a tax form for it.", true, "All income counts, so keep records and set some aside for taxes."],
    ["Self-employed people in the US pay Social Security and Medicare through self-employment tax.", true, "There's no employer paying half, so you pay both parts yourself."],
    ["You have to quit your day job to start a side hustle.", false, "Most side hustles start small on evenings and weekends, alongside a regular job."],
    ["Business expenses for a side hustle can lower the income you pay tax on.", true, "Costs you need to run the business can usually be deducted, so track every receipt."],
    ["Selling things you already own is a common way to start a side hustle.", true, "It needs no money upfront and teaches you pricing and selling."],
    ["Freelancers in the US may need to pay estimated taxes during the year.", true, "With no employer withholding tax, the IRS expects payments through the year, usually quarterly."],
    ["You must form a company before a side hustle can earn any money.", false, "In the US, many side hustles start as sole proprietors. Check your local rules, but a company often isn't required to start."],
  ],
  "real estate": [
    ["A 15-year mortgage usually has a lower interest rate than a 30-year mortgage.", true, "Lenders take less risk on shorter loans, so rates are usually lower, though the monthly payment is higher."],
    ["Paying points when you get a mortgage can lower your interest rate.", true, "Each point is a fee paid upfront in exchange for a lower rate over the life of the loan."],
    ["The monthly payment on an adjustable-rate mortgage always stays the same.", false, "After the fixed period ends, the rate can change, and so can your payment."],
    ["With a conventional loan, a down payment under 20 percent often means paying for mortgage insurance.", true, "Private mortgage insurance protects the lender, and it adds to your monthly cost."],
    ["Renting is always throwing money away.", false, "Rent buys you a home plus flexibility, and renters skip costs like repairs and property tax."],
    ["Home equity is your home's value minus what you still owe on it.", true, "It grows as you pay down the loan and as the home's value rises."],
    ["Your credit score can affect the interest rate on your mortgage.", true, "A higher score usually gets you a lower rate, which can save thousands over the loan."],
    ["Property taxes stop once your mortgage is paid off.", false, "You keep paying property taxes for as long as you own the home."],
    ["Closing costs are usually a few percent of the home's price.", true, "They often run around two to five percent, so budget for them on top of your down payment."],
  ],
};

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// A quiz script: a hook, then for each question a "True or false" line (with a countdown after it)
// and the answer line, then "How many did you get?" and your ending.
export function buildQuiz(opts, { count = 3, recent = [] } = {}) {
  const bank = QUIZ[opts.niche] || QUIZ["personal finance"];
  // Questions you haven't used lately come first.
  const fresh = shuffle(bank.filter((q) => !recent.includes(q[0]))), used = shuffle(bank.filter((q) => recent.includes(q[0])));
  const picked = [...fresh, ...used].slice(0, Math.min(count, bank.length));
  const label = { crypto: "crypto", investing: "investing", economy: "economy", "side hustles": "side hustle", "real estate": "real estate" }[opts.niche] || "money";
  const n = picked.length;
  const lines = [{ text: `Quick ${label} quiz: ${n} questions. Keep score!`, visual: "", kind: "media", chart: null }];
  picked.forEach(([q, answer, why], i) => {
    const statement = q.replace(/\.$/, "?");
    // Ordinary first words go lower case after the colon; names (Bitcoin, GDP, FDIC) keep their capitals.
    const said = /^(A|An|The|In|If|Using|Paying|Checking|Closing|Most|Money|Over|When|With|Owning|Falling|You|Business|Renting|Home|Crypto|Qualified|Payment|By|Inflation|Self-employed|Your|Automating|Investing|Bonds|Past|Anyone|Selling|Freelancers|Property|Closing)\b/.test(statement) ? statement[0].toLowerCase() + statement.slice(1) : statement;
    lines.push({ text: `Question ${i + 1}. True or false: ${said}`,
      kind: "quiz", quiz: { n: i + 1, of: n, answer }, claim: q, hold: 2.6, visual: "", chart: null });
    lines.push({ text: `${answer ? "True!" : "False!"} ${why}`, kind: "answer", answer, payoff: true, claim: answer ? q : why, visual: "", chart: null });
  });
  lines.push({ text: `How many did you get right out of ${n}? Tell me in the comments.`, kind: "media", question: true, visual: "", chart: null });
  lines.push({ text: opts.cta, visual: "", kind: "outro", chart: null });
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const cap = label.replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    kind: "quiz", topicId: `quiz-${opts.niche.replace(/\s+/g, "-")}-${date}`, title: `${cap} Quiz: Can You Get All ${n}?`, topicTitle: `${cap} quiz`,
    niche: opts.niche, lines, extras: [], tags: [`${label} quiz`, opts.niche, "quiz", "true or false"], sources: [], questions: picked.map((q) => q[0]),
  };
}
