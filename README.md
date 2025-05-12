# Inter-link Auto Bot

A powerful automation tool for managing Interlink accounts and claiming airdrops automatically.

## Features

- 🔄 Multi-account management
- 🤖 Automatic airdrop claiming
- 🔒 Secure account storage
- 🌐 Proxy support
- 📊 Real-time token balance tracking
- ⏱️ Automatic claim scheduling
- 💰 Token value calculation

## Installation

1. Clone the repository:
```bash
git clone https://github.com/himanshusaroha648/Inter-link.git
cd Inter-link
```

2. Install dependencies:
```bash
npm install
```

3. Create required files:
- `proxies.txt` (optional) - Add your proxies, one per line
- `accounts.json` (will be created automatically)

## Usage

1. Run the bot:
```bash
node index.js
```

2. Use the menu to:
   - Add new accounts
   - Run auto tasks
   - View saved accounts
   - Exit the program

## Configuration

### Proxies
Add your proxies to `proxies.txt` in the following format:
```
http://username:password@ip:port
socks5://username:password@ip:port
```

### Account Management
- Accounts are stored securely in `accounts.json`
- Each account stores:
  - Login ID
  - Email
  - Token
  - Added timestamp

## Features in Detail

### Multi-Account Support
- Manage multiple Interlink accounts
- Run all accounts simultaneously
- Individual claim tracking for each account

### Auto Task
- Automatic airdrop claiming
- Real-time balance updates
- Claim time tracking
- Token value calculation

### Security
- Secure token storage
- Proxy support for privacy
- No sensitive data logging

## Requirements

- Node.js (v12 or higher)
- npm (Node Package Manager)
- Internet connection
- Interlink account(s)

## Dependencies

- axios
- moment
- https-proxy-agent
- socks-proxy-agent

## Author

Himanshu Saroha
- GitHub: [@himanshusaroha648](https://github.com/himanshusaroha648)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This tool is for educational purposes only. Use at your own risk. The author is not responsible for any misuse or damage caused by this program.
