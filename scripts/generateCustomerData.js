const fs = require('fs');

// Helper functions
const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

// Generate a random customer
function generateCustomer(id) {
  const firstName = getRandomElement([
    'John', 'Jane', 'Michael', 'Emma', 'William', 'Olivia', 'James', 'Sophia', 
    'Robert', 'Ava', 'David', 'Isabella', 'Joseph', 'Mia', 'Thomas', 'Charlotte'
  ]);
  
  const lastName = getRandomElement([
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas'
  ]);
  
  // Determine which products this customer has
  const hasSavingsAccount = Math.random() > 0.3; // 70% chance
  const hasCheckingAccount = Math.random() > 0.4; // 60% chance
  const hasCreditCard = Math.random() > 0.5; // 50% chance
  const hasLoan = Math.random() > 0.7; // 30% chance
  const hasFixedDeposit = Math.random() > 0.6; // 40% chance
  const hasInvestment = Math.random() > 0.8; // 20% chance
  
  // Build products array
  const products = [];
  
  if (hasSavingsAccount) {
    products.push({
      type: 'Savings Account',
      accountNumber: `SA-${100000 + id}`,
      balance: parseFloat((Math.random() * 50000 + 1000).toFixed(2)),
      interestRate: parseFloat((Math.random() * 2 + 0.5).toFixed(2)),
      openedDate: getRandomDate(new Date(2015, 0, 1), new Date()).toISOString().split('T')[0]
    });
  }
  
  if (hasCheckingAccount) {
    products.push({
      type: 'Checking Account',
      accountNumber: `CA-${200000 + id}`,
      balance: parseFloat((Math.random() * 20000 + 500).toFixed(2)),
      monthlyFee: parseFloat((Math.random() * 15).toFixed(2)),
      openedDate: getRandomDate(new Date(2015, 0, 1), new Date()).toISOString().split('T')[0]
    });
  }
  
  if (hasCreditCard) {
    products.push({
      type: 'Credit Card',
      cardNumber: `CC-${300000 + id}`,
      creditLimit: getRandomInt(1000, 30000),
      currentBalance: parseFloat((Math.random() * 10000).toFixed(2)),
      interestRate: parseFloat((Math.random() * 10 + 12).toFixed(2)),
      issueDate: getRandomDate(new Date(2018, 0, 1), new Date()).toISOString().split('T')[0]
    });
  }
  
  if (hasLoan) {
    const loanTypes = ['Personal', 'Auto', 'Home', 'Education'];
    products.push({
      type: `${getRandomElement(loanTypes)} Loan`,
      loanNumber: `LN-${400000 + id}`,
      originalAmount: parseFloat((Math.random() * 500000 + 5000).toFixed(2)),
      outstandingBalance: parseFloat((Math.random() * 400000 + 1000).toFixed(2)),
      interestRate: parseFloat((Math.random() * 8 + 3).toFixed(2)),
      startDate: getRandomDate(new Date(2015, 0, 1), new Date()).toISOString().split('T')[0],
      term: getRandomElement([12, 24, 36, 48, 60, 120, 180, 240, 360]) // months
    });
  }
  
  if (hasFixedDeposit) {
    products.push({
      type: 'Fixed Deposit',
      accountNumber: `FD-${500000 + id}`,
      principal: parseFloat((Math.random() * 100000 + 10000).toFixed(2)),
      interestRate: parseFloat((Math.random() * 3 + 2).toFixed(2)),
      startDate: getRandomDate(new Date(2018, 0, 1), new Date()).toISOString().split('T')[0],
      term: getRandomElement([3, 6, 12, 24, 36, 60]) // months
    });
  }
  
  if (hasInvestment) {
    products.push({
      type: 'Investment Portfolio',
      accountNumber: `IP-${600000 + id}`,
      currentValue: parseFloat((Math.random() * 200000 + 5000).toFixed(2)),
      initialInvestment: parseFloat((Math.random() * 150000 + 5000).toFixed(2)),
      startDate: getRandomDate(new Date(2015, 0, 1), new Date()).toISOString().split('T')[0],
      riskProfile: getRandomElement(['Conservative', 'Moderate', 'Aggressive'])
    });
  }
  
  // Generate some recent transactions
  const transactions = [];
  const numTransactions = getRandomInt(3, 10);
  
  for (let i = 0; i < numTransactions; i++) {
    const transactionTypes = ['Deposit', 'Withdrawal', 'Transfer', 'Payment', 'Purchase'];
    const transactionType = getRandomElement(transactionTypes);
    
    let amount = parseFloat((Math.random() * 1000 + 10).toFixed(2));
    if (transactionType === 'Withdrawal' || transactionType === 'Payment' || transactionType === 'Purchase') {
      amount = -amount;
    }
    
    transactions.push({
      date: getRandomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()).toISOString().split('T')[0],
      type: transactionType,
      amount: amount,
      description: getRandomElement([
        'Grocery Store', 'Salary', 'Rent Payment', 'Utility Bill', 'Online Shopping',
        'Restaurant', 'Gas Station', 'Transfer to Savings', 'ATM Withdrawal', 'Subscription'
      ])
    });
  }
  
  // Sort transactions by date (newest first)
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Customer contact information
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${getRandomInt(1, 999)}@example.com`;
  const phoneNumber = `(${getRandomInt(100, 999)}) ${getRandomInt(100, 999)}-${getRandomInt(1000, 9999)}`;
  
  // Customer address
  const streets = ['Main St', 'Oak Ave', 'Maple Rd', 'Washington Blvd', 'Park Lane', 'Cedar Dr'];
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego'];
  const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'FL', 'OH'];
  
  const address = {
    street: `${getRandomInt(100, 9999)} ${getRandomElement(streets)}`,
    city: getRandomElement(cities),
    state: getRandomElement(states),
    zipCode: getRandomInt(10000, 99999).toString()
  };
  
  // Customer profile
  return {
    id: id,
    customerId: `CUST-${100000 + id}`,
    firstName: firstName,
    lastName: lastName,
    email: email,
    phoneNumber: phoneNumber,
    address: address,
    dateOfBirth: getRandomDate(new Date(1960, 0, 1), new Date(2000, 0, 1)).toISOString().split('T')[0],
    joinDate: getRandomDate(new Date(2010, 0, 1), new Date()).toISOString().split('T')[0],
    customerRating: getRandomInt(1, 5),
    products: products,
    recentTransactions: transactions,
    notes: getRandomElement([
      'Prefers email communication',
      'Interested in investment opportunities',
      'Considering a home loan',
      'Recently updated contact information',
      'Frequent traveler, uses card internationally',
      'Prefers in-person banking',
      'Has referred multiple customers',
      '',
      '',
      ''
    ])
  };
}

// Generate 1000 customers
const customers = [];
for (let i = 1; i <= 1000; i++) {
  customers.push(generateCustomer(i));
}

// Write to file
fs.writeFileSync('data/customers.json', JSON.stringify(customers, null, 2));
console.log('Generated 1000 customer records in data/customers.json'); 