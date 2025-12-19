// Paste your GOOGLE_PRIVATE_KEY from the JSON file here (including the BEGIN and END lines)
const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7fVJyvfub0TGo
Ri029fAYRDVDHBdcsEBcDAXG1p1TxRmOuPJx5kXqtA5NOr4P0iAvEmiwQvLz0KMh
x4InMrraMwXeLGBJVhF8NlvV18slD5hKIGYTD82UJ6+1JmsaS6jxN+J55R4KYwgg
OUBm6pL9CHoMMR0DkYWwQsCOXj83fR0vts3462qBwEss9EN1Ejj2irqp26xgu2tt
iJZiegCiEUc7KElj2CLRAV6W0VvCjFQA28ItRJpQXRpEwsyKEZi4QFTmy5WHf8D7
KjT/huoIYxcQsMfPxbtvTQXI5LBhDAIpUkUljHoOUPNob/QpJ6yfwYG0crSsHfhe
7HJa7YnDAgMBAAECggEAIEex78506P1p+spmU32hglQQBYdrIEq6Mf7h6buep8Ma
JOAD4gdfB0tL4REZkxi+8MvPGXXVZZQI2jKC3qPV1uaM/pUOWOIILaYgRp+aOr3G
HxEX8fU5FGaG0n4UV5kqM6nHBOylMO2fAwlIZM/DUexpMvsrvycJaPD9PSXN5YwJ
cE+watFlG1gFjPVAadXDEHi8Z/0S0NhfrCVSTIACyzI6I/s05v9vexYEFqSu6WxE
b/wpdvOTw44gmD4H73lpM5Z7sxETg5YoojRw0hPmB/YBmgkwVGz+LBitabB64n0a
fFB9w8hyXUalzxdiyQ3KbQfN0k/g1lmbqVEy3VQuJQKBgQD5DB8K2TsencThHAUW
vL29ojcCjSTKy8WkCKnt1qoa0AFj1HteOTEOoKQcef7kMiHwAMY4ibrqg61rrVab
8Y4hVQOsx2pEGeLhDYjEW2V5IPpmgCQRuXcCSK/joK9tHqzWV6NC9lRyZVQ6CAos
00Vo86mIJvh4gP6gycS3uOITNQKBgQDAuUM7npwMkwRd/DmA4/pMnAl20oZsjx0V
3xFD5Rf7cAEK7iBS4VFAK0spHj7NDNI2zNRmzIAESWHHhGg/2nLGfUdQRgXcZllF
VdijqoBAbylmbkAKTWjKHpMGlTQgbCy2sbSWhhBPrZe0MsGZioeUtNt7CrAggbCR
Vi0ubpCQFwKBgEcQ02bYGAujf4Ow6C7VytrrCAF9XytTPGGTa1IH+GBQTKU9A7se
XMZMxqetlDNvrsl6nxWRD7pNutXID7fOFP2j8bmC6erm7BvGLenCHtGSvIE1PZWl
M7V+Ilq1Bnn/z9gWB+tauTwvd/pbQvQJkXviU9UbMbnJLV+aU70NT82lAoGBAKp0
8cdQoPrqKYmrJX0fpumNdT14NNbdub73fkDL5utIBFQTi9liWkfkQuUKUEdyWJeJ
kS+fHncsJGSgcshPQQbYFXQliteGWtzdcfBIRIk5CKgFSXUTRGTIqAfBfcpTgzTP
dkdQKisfAbeq0Nsp0IMxd5KbQG5v5qiVTP7tYcVfAoGAfLZir9SUiVFuAv0owqHZ
U3WX0LEAzcY5oI/wjx4P4W/9AjiQOWB1nXanV3Ol+V0Qhr8MgVKF0eW67uVVoNTu
0UNXa3Ra2HyfL1C3swVttG/HxwhfyQde5Nwi0Lj2cS+kIBLbuvE5iHiQRrtJkfso
plfTR3TvdYjYqBsuvlJB3l8=
-----END PRIVATE KEY-----`;

// Convert to Railway format (single line with \n escape sequences)
const railwayFormat = privateKey.replace(/\n/g, '\\n');

console.log('\n========================================');
console.log('Copy this ENTIRE line for Railway:');
console.log('========================================\n');
console.log(`GOOGLE_PRIVATE_KEY="${railwayFormat}"`);
console.log('\n========================================\n');
