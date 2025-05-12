const axios = require('axios');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const readline = require('readline');
const { clear } = require('console');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const https = require('https');

const API_BASE_URL = 'https://prod.interlinklabs.ai/api/v1';
const TOKEN_FILE_PATH = path.join(__dirname, 'token.txt');
const PROXIES_FILE_PATH = path.join(__dirname, 'proxies.txt');
const ACCOUNTS_FILE_PATH = path.join(__dirname, 'accounts.json');
const CLAIM_INTERVAL_MS = 4 * 60 * 60 * 1000; 

const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const logger = {
  info: (msg) => console.log(`${colors.green}[✓] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[⚠] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[✅] ${msg}${colors.reset}`),
  loading: (msg) => console.log(`${colors.cyan}[⟳] ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.white}[➤] ${msg}${colors.reset}`),
  banner: () => {
    console.log(`${colors.cyan}${colors.bold}`);
    console.log(`---------------------------------------------`);
    console.log(`Interlink   Auto Bot - HIMANSHU SAROHA`);
    console.log(`---------------------------------------------${colors.reset}`);
    console.log();
  }
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function promptInput(question) {
  return new Promise((resolve) => {
    rl.question(`${colors.white}${question}${colors.reset}`, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function sendOtp(apiClient, loginId, passcode, email) {
  try {
    const payload = { loginId, passcode, email };
    const response = await apiClient.post('/auth/send-otp-email-verify-login', payload);
    if (response.data.statusCode === 200) {
      logger.success(response.data.message);
      logger.info(`If OTP doesn't arrive, stop the bot (Ctrl+C) and restart.`);
    } else {
      logger.error(`Failed to send OTP: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    logger.error(`Error sending OTP: ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      logger.error(`Response details: ${JSON.stringify(error.response.data)}`);
    }
  }
}

async function verifyOtp(apiClient, loginId, otp) {
  try {
    const payload = { loginId, otp };
    const response = await apiClient.post('/auth/check-otp-email-verify-login', payload);
    if (response.data.statusCode === 200) {
      logger.success(response.data.message);
      const token = response.data.data.jwtToken;
      saveToken(token);
      return token;
    } else {
      logger.error(`Failed to verify OTP: ${JSON.stringify(response.data)}`);
      return null;
    }
  } catch (error) {
    logger.error(`Error verifying OTP: ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      logger.error(`Response details: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

function saveToken(token) {
  try {
    fs.writeFileSync(TOKEN_FILE_PATH, token);
    logger.info(`Token saved to ${TOKEN_FILE_PATH}`);
  } catch (error) {
    logger.error(`Error saving token: ${error.message}`);
  }
}

async function login(proxies) {
  const loginId = await promptInput('Enter your login ID (or email): ');
  const passcode = await promptInput('Enter your passcode: ');
  const email = await promptInput('Enter your email: ');

  let apiClient;
  const proxy = getRandomProxy(proxies);

  if (proxy) {
    logger.step(`Attempting to send OTP with proxy: ${proxy}`);
    apiClient = createApiClient(null, proxy);
  } else {
    logger.step(`Attempting to send OTP without proxy...`);
    apiClient = createApiClient(null);
  }

  await sendOtp(apiClient, loginId, passcode, email);
  const otp = await promptInput('Enter OTP: ');
  const token = await verifyOtp(apiClient, loginId, otp);

  return token;
}

function readToken() {
  try {
    return fs.readFileSync(TOKEN_FILE_PATH, 'utf8').trim();
  } catch (error) {
    logger.warn(`Token file not found or invalid. Will attempt login.`);
    return null;
  }
}

function readProxies() {
  try {
    if (!fs.existsSync(PROXIES_FILE_PATH)) {
      logger.warn(`Proxies file not found. Running without proxies.`);
      return [];
    }
    
    const content = fs.readFileSync(PROXIES_FILE_PATH, 'utf8');
    return content.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } catch (error) {
    logger.error(`Error reading proxies file: ${error.message}`);
    return [];
  }
}

function getRandomProxy(proxies) {
  if (!proxies.length) return null;
  return proxies[Math.floor(Math.random() * proxies.length)];
}

function createProxyAgent(proxyUrl) {
  if (!proxyUrl) return null;

  if (proxyUrl.startsWith('socks://') || proxyUrl.startsWith('socks4://') || proxyUrl.startsWith('socks5://')) {
    return new SocksProxyAgent(proxyUrl);
  } else {
    return new HttpsProxyAgent(proxyUrl);
  }
}

function createApiClient(token, proxy = null) {
  const config = {
    baseURL: API_BASE_URL,
    headers: {
      'User-Agent': 'okhttp/4.12.0',
      'Accept-Encoding': 'gzip'
    },
    timeout: 30000,
    httpsAgent: new https.Agent({ 
      rejectUnauthorized: false
    })
  };
  
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (proxy) {
    try {
      const proxyAgent = createProxyAgent(proxy);
      config.httpsAgent = proxyAgent;
      config.proxy = false;
      logger.info(`Using proxy: ${proxy}`);
    } catch (error) {
      logger.error(`Error setting up proxy: ${error.message}`);
    }
  }
  
  return axios.create(config);
}

function formatTimeRemaining(milliseconds) {
  if (milliseconds <= 0) return '00:00:00';
  
  const seconds = Math.floor((milliseconds / 1000) % 60);
  const minutes = Math.floor((milliseconds / (1000 * 60)) % 60);
  const hours = Math.floor((milliseconds / (1000 * 60 * 60)) % 24);
  
  return [hours, minutes, seconds]
    .map(val => val.toString().padStart(2, '0'))
    .join(':');
}

async function getCurrentUser(apiClient) {
  try {
    const response = await apiClient.get('/auth/current-user');
    return response.data.data;
  } catch (error) {
    logger.error(`Error getting user information: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function getTokenBalance(apiClient) {
  try {
    const response = await apiClient.get('/token/get-token');
    return response.data.data;
  } catch (error) {
    logger.error(`Error getting token balance: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function checkIsClaimable(apiClient) {
  try {
    const response = await apiClient.get('/token/check-is-claimable');
    return response.data.data;
  } catch (error) {
    logger.error(`Error checking if airdrop is claimable: ${error.response?.data?.message || error.message}`);
    return { isClaimable: false, nextFrame: Date.now() + 1000 * 60 * 5 };
  }
}

async function claimAirdrop(apiClient) {
  try {
    const response = await apiClient.post('/token/claim-airdrop');
    logger.success(`Airdrop claimed successfully!`);
    return response.data;
  } catch (error) {
    logger.error(`Error claiming airdrop: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

function calculateTotalValue(tokenInfo) {
  // Example conversion rates (you can update these with actual rates)
  const rates = {
    interlinkGoldToken: 0.5,    // $0.50 per token
    interlinkSilverToken: 0.25,  // $0.25 per token
    interlinkDiamondToken: 1.0,  // $1.00 per token
    interlinkToken: 0.1         // $0.10 per token
  };

  const totalValue = (
    (tokenInfo.interlinkGoldTokenAmount * rates.interlinkGoldToken) +
    (tokenInfo.interlinkSilverTokenAmount * rates.interlinkSilverToken) +
    (tokenInfo.interlinkDiamondTokenAmount * rates.interlinkDiamondToken) +
    (tokenInfo.interlinkTokenAmount * rates.interlinkToken)
  ).toFixed(2);

  return totalValue;
}

function displayUserInfo(userInfo, tokenInfo) {
  if (!userInfo || !tokenInfo) return;
  
  console.log('\n' + '='.repeat(50));
  console.log(`${colors.yellow}${colors.bold}👤 USER INFORMATION${colors.reset}`);
  console.log(`${colors.yellow}Username:${colors.reset} ${userInfo.username}`);
  console.log(`${colors.yellow}Email:${colors.reset} ${userInfo.email}`);
  console.log(`${colors.yellow}Wallet:${colors.reset} ${userInfo.connectedAccounts?.wallet?.address || 'Not connected'}`);
  console.log(`${colors.yellow}User ID:${colors.reset} ${userInfo.loginId}`);
  console.log(`${colors.yellow}Referral ID:${colors.reset} ${tokenInfo.userReferralId}`);
  
  console.log('\n' + '='.repeat(50));
  console.log(`${colors.yellow}${colors.bold}💰 TOKEN BALANCE${colors.reset}`);
  console.log(`${colors.yellow}Gold Tokens:${colors.reset} ${tokenInfo.interlinkGoldTokenAmount}`);
  console.log(`${colors.yellow}Silver Tokens:${colors.reset} ${tokenInfo.interlinkSilverTokenAmount}`);
  console.log(`${colors.yellow}Diamond Tokens:${colors.reset} ${tokenInfo.interlinkDiamondTokenAmount}`);
  console.log(`${colors.yellow}Interlink Tokens:${colors.reset} ${tokenInfo.interlinkTokenAmount}`);
  console.log(`${colors.yellow}Last Claim:${colors.reset} ${moment(tokenInfo.lastClaimTime).format('YYYY-MM-DD HH:mm:ss')}`);
  
  const totalValue = calculateTotalValue(tokenInfo);
  console.log(`${colors.yellow}Total Value:${colors.reset} $${totalValue} USD`);
  console.log('='.repeat(50) + '\n');
}

async function tryConnect(token, proxies) {
  let apiClient;
  let userInfo = null;
  let tokenInfo = null;
  
  logger.step(`Attempting connection without proxy...`);
  apiClient = createApiClient(token);
  
  logger.loading(`Retrieving user information...`);
  userInfo = await getCurrentUser(apiClient);
  
  if (!userInfo && proxies.length > 0) {
    let attempts = 0;
    const maxAttempts = Math.min(proxies.length, 5);
    
    while (!userInfo && attempts < maxAttempts) {
      const proxy = proxies[attempts];
      logger.step(`Trying with proxy ${attempts + 1}/${maxAttempts}: ${proxy}`);
      
      apiClient = createApiClient(token, proxy);
      
      logger.loading(`Retrieving user information...`);
      userInfo = await getCurrentUser(apiClient);
      attempts++;
      
      if (!userInfo) {
        logger.warn(`Proxy ${proxy} failed. Trying next...`);
      }
    }
  }
  
  if (userInfo) {
    logger.loading(`Retrieving token balance...`);
    tokenInfo = await getTokenBalance(apiClient);
  }
  
  return { apiClient, userInfo, tokenInfo };
}

function saveAccount(accountData) {
  try {
    let accounts = [];
    if (fs.existsSync(ACCOUNTS_FILE_PATH)) {
      accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE_PATH, 'utf8'));
    }
    
    // Check if account already exists
    const existingIndex = accounts.findIndex(acc => acc.loginId === accountData.loginId);
    if (existingIndex !== -1) {
      accounts[existingIndex] = accountData;
    } else {
      accounts.push(accountData);
    }
    
    fs.writeFileSync(ACCOUNTS_FILE_PATH, JSON.stringify(accounts, null, 2));
    logger.success(`Account saved successfully!`);
  } catch (error) {
    logger.error(`Error saving account: ${error.message}`);
  }
}

function loadAccounts() {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE_PATH)) {
      return [];
    }
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE_PATH, 'utf8'));
  } catch (error) {
    logger.error(`Error loading accounts: ${error.message}`);
    return [];
  }
}

async function addNewAccount(proxies) {
  logger.step('Adding new account...');
  const loginId = await promptInput('Enter login ID (or email): ');
  const passcode = await promptInput('Enter passcode: ');
  const email = await promptInput('Enter email: ');

  let apiClient;
  const proxy = getRandomProxy(proxies);

  if (proxy) {
    logger.step(`Attempting to send OTP with proxy: ${proxy}`);
    apiClient = createApiClient(null, proxy);
  } else {
    logger.step(`Attempting to send OTP without proxy...`);
    apiClient = createApiClient(null);
  }

  await sendOtp(apiClient, loginId, passcode, email);
  const otp = await promptInput('Enter OTP: ');
  const token = await verifyOtp(apiClient, loginId, otp);

  if (token) {
    const accountData = {
      loginId,
      passcode,
      email,
      token,
      addedAt: new Date().toISOString()
    };
    saveAccount(accountData);
    return true;
  }
  return false;
}

async function runAccount(account, proxies) {
  try {
    logger.step(`Running account: ${account.loginId}`);
    let { apiClient, userInfo, tokenInfo } = await tryConnect(account.token, proxies);
    
    if (!userInfo || !tokenInfo) {
      logger.error(`Failed to connect with account ${account.loginId}. Skipping...`);
      return;
    }
    
    logger.success(`Connected as ${userInfo.username}`);
    displayUserInfo(userInfo, tokenInfo);
    
    async function attemptClaim() {
      let currentApiClient = apiClient;
      if (proxies.length > 0) {
        const randomProxy = getRandomProxy(proxies);
        currentApiClient = createApiClient(account.token, randomProxy);
      }
      
      const claimCheck = await checkIsClaimable(currentApiClient);
      
      if (claimCheck.isClaimable) {
        logger.loading(`Airdrop is claimable for ${account.loginId}! Attempting to claim...`);
        await claimAirdrop(currentApiClient);
        
        logger.loading(`Updating token information...`);
        const newTokenInfo = await getTokenBalance(currentApiClient);
        if (newTokenInfo) {
          tokenInfo = newTokenInfo;
          displayUserInfo(userInfo, tokenInfo);
        }
      }
      
      return claimCheck.nextFrame;
    }
    
    let nextClaimTime = await attemptClaim();
    
    const updateCountdown = () => {
      const now = Date.now();
      const timeRemaining = Math.max(0, nextClaimTime - now);
      
      process.stdout.write(`\r${colors.white}⏱️ Next claim for ${account.loginId} in: ${colors.bold}${formatTimeRemaining(timeRemaining)}${colors.reset}     `);
      
      if (timeRemaining <= 0) {
        process.stdout.write('\n');
        logger.step(`Claim time reached for ${account.loginId}!`);
        
        attemptClaim().then(newNextFrame => {
          nextClaimTime = newNextFrame;
        });
      }
    };
    
    setInterval(updateCountdown, 1000);
    
    const scheduleNextCheck = () => {
      const now = Date.now();
      const timeUntilNextCheck = Math.max(1000, nextClaimTime - now);
      
      setTimeout(async () => {
        logger.step(`Scheduled claim time reached for ${account.loginId}.`);
        nextClaimTime = await attemptClaim();
        scheduleNextCheck();
      }, timeUntilNextCheck);
    };
    
    scheduleNextCheck();
  } catch (error) {
    logger.error(`Error running account ${account.loginId}: ${error.message}`);
  }
}

async function showMenu() {
  const accounts = loadAccounts();
  const proxies = readProxies();
  
  while (true) {
    clear();
    logger.banner();
    
    console.log('\n' + '='.repeat(50));
    console.log(`${colors.cyan}${colors.bold}MAIN MENU${colors.reset}`);
    console.log('='.repeat(50));
    console.log(`${colors.white}1.${colors.reset} Run Auto Task (${accounts.length} accounts)`);
    console.log(`${colors.white}2.${colors.reset} Add New Account`);
    console.log(`${colors.white}3.${colors.reset} View Saved Accounts`);
    console.log(`${colors.white}4.${colors.reset} Exit`);
    console.log('='.repeat(50));
    
    const choice = await promptInput('\nEnter your choice (1-4): ');
    
    switch (choice) {
      case '1':
        if (accounts.length === 0) {
          logger.warn('No accounts found. Please add an account first.');
          await promptInput('\nPress Enter to continue...');
          continue;
        }
        clear();
        logger.step('Starting auto task for all accounts...');
        for (const account of accounts) {
          await runAccount(account, proxies);
        }
        await promptInput('\nPress Enter to return to menu...');
        break;
        
      case '2':
        clear();
        await addNewAccount(proxies);
        await promptInput('\nPress Enter to return to menu...');
        break;
        
      case '3':
        clear();
        if (accounts.length === 0) {
          logger.warn('No accounts found.');
        } else {
          console.log('\n' + '='.repeat(50));
          console.log(`${colors.cyan}${colors.bold}SAVED ACCOUNTS${colors.reset}`);
          console.log('='.repeat(50));
          accounts.forEach((acc, index) => {
            console.log(`${colors.white}${index + 1}.${colors.reset} Login ID: ${acc.loginId}`);
            console.log(`   Email: ${acc.email}`);
            console.log(`   Added: ${moment(acc.addedAt).format('YYYY-MM-DD HH:mm:ss')}`);
            console.log('-'.repeat(50));
          });
        }
        await promptInput('\nPress Enter to return to menu...');
        break;
        
      case '4':
        logger.info('Exiting...');
        process.exit(0);
        break;
        
      default:
        logger.warn('Invalid choice. Please try again.');
        await promptInput('\nPress Enter to continue...');
    }
  }
}

showMenu().finally(() => rl.close());
