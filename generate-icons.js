const sharp = require('sharp');
const path = require('path');

async function generateIcon() {
    try {
        await sharp(path.join(__dirname, 'icons', 'icon48.png'))
            .resize(32, 32)
            .toFile(path.join(__dirname, 'icons', 'icon32.png'));
        
        console.log('Successfully generated icon32.png');
    } catch (error) {
        console.error('Error generating icon:', error);
    }
}

generateIcon(); 