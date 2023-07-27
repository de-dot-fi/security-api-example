import { join } from 'path'
import express from 'express'
import { createClient } from '@de-fi/sdk'

const app = express()
const apiKey = '86abd2277e63451b806f37e33a89a48b'
const apiUrl = 'https://public-api.de.fi/graphql'
const port = 8000

app.use(express.static('dist'))
app.use('/images', express.static('images'))

const defiClient = createClient({
    url: apiUrl,
    headers: {
        'X-Api-Key': apiKey,
    }
})

const getUniqueTokensAndBalances = (tokensApproved, userTokensAndBalances) => {
    const blockNumbers = tokensApproved.map(item => item.block)
    const tokensApprovedLowerCase = tokensApproved.map(item => item.token.toLowerCase())
    const userHoldingsLowerCase = userTokensAndBalances.map(item => item.token.toLowerCase())
    const results = []

    for(let i = 0; i < userHoldingsLowerCase.length; i++) {
        const elementSecond = userHoldingsLowerCase[i]
        if (tokensApprovedLowerCase.indexOf(elementSecond) != -1) {
            results.push({
                ...userTokensAndBalances[i],
                blockNumber: blockNumbers[i],
            })
        }
    }

    return results
}

const getShield = async walletToCheck => {
    // 1. Get the approvals for all the ERC20s and NFTs
    let query
    let secondQuery
    try {
        query = await defiClient.query({
            shieldApprovals: [{
                where: {
                    address: walletToCheck,
                    chainId: 1,
                }
            }, {
                token: true,
                block: true,
            }]
        })
    } catch (e) {
        console.log('Error', e)
        return { error: e }
    }
    try {
        secondQuery = await defiClient.query({
            shieldApprovalsNft: [{
                where: {
                    address: walletToCheck,
                    chainId: 1,
                }
            }, {
                token: true,
                block: true,
            }]
        })
    } catch (e) {
        console.log('Error', e)
        return { error: e }
    }
    query = {
        tokenApprovals: query,
        nftApprovals: secondQuery,
    }

    // Remove duplicates
    let uniqueIds = []
    let finalUniques = []
    const nftApprovalsEnds = query.nftApprovals.data.shieldApprovalsNft.length
    const combined = query.nftApprovals.data.shieldApprovalsNft.concat(query.tokenApprovals.data.shieldApprovals)
    combined.map(item => item.token.toLowerCase()).map((item, i) => {
        if (uniqueIds.indexOf(item) == -1) {
            uniqueIds.push(item)
            if (i < nftApprovalsEnds) {
                finalUniques.push(query.nftApprovals.data.shieldApprovalsNft[i])
            } else {
                finalUniques.push(query.tokenApprovals.data.shieldApprovals[i])
            }
        }
    })
    // 2. Get the user token holdings regarding the tokens
    let userTokensAndBalances = null
    try {
        userTokensAndBalances = await defiClient.query({
            assetBalances: [{
                walletAddress: walletToCheck,
                chainId: 1,
            }, {
                assets: {
                    balance: true,
                    asset: {
                        address: true,
                    }
                }
            }]
        })
    } catch (e) {
        console.log('error', e)
        return { error: e }
    }
    // Remove empty results
    userTokensAndBalances = userTokensAndBalances.data.assetBalances.assets
        .filter(item => item.asset.address != '0x0000000000000000000000000000000000000000')
        .map(item => {
            return {
                token: item.asset.address,
                balance: item.balance,
            }
        })
    // 3. Compare which ones are in the user wallet right now and check the contracts
    const uniqueTokensAndBalances = getUniqueTokensAndBalances(finalUniques, userTokensAndBalances)
    const uniqueTokenAddressesLowerCase = uniqueTokensAndBalances.map(item => item.token.toLowerCase())
    if (uniqueTokensAndBalances.length == 0) return []

    // 4. Get the issues with shieldAdvanced
    let tokenSecurityIssues = null
    try {
        tokenSecurityIssues = await defiClient.query({
            shieldAdvanced: [{
                where: {
                    addresses: uniqueTokenAddressesLowerCase,
                    chainId: 1,
                }
            }, {
                contracts: {
                    address: true,
                    name: true,
                    issues: {
                        title: true,
                        description: true,
                        impact: true,
                    }
                }
            }]
        })
    } catch (e) {
        console.log('error', e)
        return { error: e }
    }

    // Removing duplicate issues
    tokenSecurityIssues.data.shieldAdvanced.contracts = tokenSecurityIssues.data.shieldAdvanced.contracts.map((contractData, i) => {
        return {
            ...contractData,
            issues: contractData.issues.filter((value, index) => {
                const _value = JSON.stringify(value)
                return index === contractData.issues.findIndex(obj => {
                    return JSON.stringify(obj) === _value
                })
            }),
            blockNumber: uniqueTokensAndBalances[i].blockNumber,
        }
    })

    // 5. Send it to the user
    return tokenSecurityIssues.data.shieldAdvanced.contracts
}

const getScannerLiquidityAnalysis = async walletToCheck => {
    let query
    try {
        query = await defiClient.query({
            scannerLiquidityAnalysis: [{
                where: {
                    address: walletToCheck,
                    chainId: 1,
                }
            }, {
                totalLiquidity: true,
                totalLockedPercent: true,
                liquidityPools: {
                    name: true,
                    address: true,
                }
            }]
        })
    } catch (e) {
        console.log('Error', e)
        return { error: e }
    }
    return query
}

const getHolderAnalysis = async walletToCheck => {
    let query
    try {
        query = await defiClient.query({
            scannerHolderAnalysis: [{
                where: {
                    address: walletToCheck,
                    chainId: 1,
                }
            }, {
                topHolders: {
                    address: true,
                    percent: true,
                },
            }]
        })
    } catch (e) {
        console.log('Error', e)
        return { error: e }
    }
    return query
}

const getScannerProject = async walletToCheck => {
    let query
    try {
        query = await defiClient.query({
            scannerProject: [{
                where: {
                    address: walletToCheck,
                    chainId: 1,
                }
            }, {
                address: true,
                coreIssues: {
                    scwDescription: true,
                },
                generalIssues: {
                    scwDescription: true,
                }
            }]
        })
    } catch (e) {
        console.log('Error', e)
        return { error: e }
    }
    const liquidityQuery = await getScannerLiquidityAnalysis(walletToCheck)
    const holdersQuery = await getHolderAnalysis(walletToCheck)

    return {
        scannerProject: query,
        scannerLiquidityAnalysis: liquidityQuery,
        holderAnalysis: holdersQuery,
    }
}

app.get('/shield/:wallet', async (req, res) => {
    const results = await getShield(req.params.wallet)
    if (results.error) {
        return res.send(JSON.stringify({error: results.error}))
    }
    res.send(JSON.stringify(results))
})

app.get('/scanner-project/:wallet', async (req, res) => {
    const results = await getScannerProject(req.params.wallet)
    if (results.error) {
        return res.send(JSON.stringify({error: results.error}))
    }
    res.send(JSON.stringify(results))
})

app.listen(port, '0.0.0.0', () => {
    console.log(`Listening on localhost:${port}`)
})