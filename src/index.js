import { EthereumClient, w3mConnectors, w3mProvider } from '@web3modal/ethereum'
import { Web3Modal } from '@web3modal/html'
import { configureChains, createConfig } from '@wagmi/core'
import { mainnet } from '@wagmi/core/chains'
import { getAccount } from '@wagmi/core'

const chains = [mainnet]
const projectId = '8e6b5ffdcbc9794bf9f4a1952578365b' // Get yours at https://cloud.walletconnect.com/
const { publicClient } = configureChains(chains, [w3mProvider({ projectId })])
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: w3mConnectors({ projectId, version: 1, chains }),
  publicClient
})
const ethereumClient = new EthereumClient(wagmiConfig, chains)
const web3modal = new Web3Modal({ projectId }, ethereumClient)
const shieldApiUrl = 'http://localhost:8000'

const getShield = async walletAddress => {
    fetch(`${shieldApiUrl}/shield/${walletAddress}`)
        .then(response => response.json())
        .then(response => {
            if (response.length == 0) {
                return document.querySelector('#vulnerabilities-list').innerHTML = `
                <tr>
                    <td class="empty-table" colspan="4">You don't hold any tokens at risk</td>
                </tr>
                `
            }

            let html = ''
            response.forEach(item => {
                html += `
                    <tr>
                        <td>
                            ${item.name}
                            <br/>
                            ${item.address}
                        </td>
                        <td>
                            <ul class="issue-items">
                                ${item.issues.map(issue => `
                                    <li>
                                        ${issue.title}
                                        <div class="info-icon">
                                            <img src="images/info.png" class="my-info-icon"/>
                                            <div class="tooltip">${issue.description}</div>
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        </td>
                        <td>
                            <ul>
                                ${item.issues.map(issue => `
                                    <li>${issue.impact}</li>
                                `).join('')}
                            </ul>
                        </td>
                        <td>${item.blockNumber}</td>
                    </tr>
                `
            })

            document.querySelector('#vulnerabilities-list').innerHTML = html
        })
}

const getScannerData = async address => {
    fetch(`${shieldApiUrl}/scanner-project/${address}`)
        .then(response => response.json())
        .then(response => {
            let html = ''
            html += `
                <h4>Liquidity Analysis</h4>
                <p><b>Total liquidity:</b> ${response.scannerLiquidityAnalysis.data.scannerLiquidityAnalysis.totalLiquidity}</p>
                <p><b>Total locked percentage:</b> ${response.scannerLiquidityAnalysis.data.scannerLiquidityAnalysis.totalLockedPercent.toFixed(2)}%</p>
                <table class="holders-table">
                    <thead>
                        <tr>
                            <th>Pool Name</th>
                            <th>Pool Address</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${response.scannerLiquidityAnalysis.data.scannerLiquidityAnalysis.liquidityPools.map(pool => {
                            return `
                                <tr>
                                    <td>${pool.name}</td>
                                    <td>${pool.address}</td>
                                </tr>
                            `
                        }).join('')}
                    </tbody>
                </table>

                <h4>Holder analysis</h4>
                <table class="holders-table">
                    <thead>
                        <tr>
                            <th>Holder</th>
                            <th>Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${response.holderAnalysis.data.scannerHolderAnalysis.topHolders.map(holder => {
                            return `
                                <tr>
                                    <td>${holder.address}</td>
                                    <td>${holder.percent.toFixed(2)}%</td>
                                </tr>
                            `
                        }).join('')}
                    </tbody>
                </table>

                <h4>Core issues</h4>
                ${response.scannerProject.data.scannerProject.coreIssues.map(issue => `<p>${issue.scwDescription}</p>`).join('')}

                <h4>General issues</h4>
                ${response.scannerProject.data.scannerProject.generalIssues.map(issue => `<p>${issue.scwDescription}</p>`).join('')}
            `
            document.querySelector('#scanner-issues').innerHTML = html
        })
}

document.querySelector('#scan-button').addEventListener('click', () => {
    const userInput = document.querySelector('#scan-input').value
    const userAddress = getAccount().address
    if (!userAddress && userInput === '') return alert('No addresses detected')
    if (userInput != '' && userInput.length != 42) return alert('Incorrect address detected')
    if (userInput === '') getShield(userAddress)
    else getShield(userInput)
})

document.querySelector('#scan-token-button').addEventListener('click', () => {
    const address = document.querySelector('#scan-token-input').value
    getScannerData(address)
})