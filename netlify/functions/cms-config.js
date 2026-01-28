const fs = require('fs');
const path = require('path');

exports.handler = async () => {
  const configPath = path.join(__dirname, '../../cms/config.yml');
  const config = fs.readFileSync(configPath, 'utf8');
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/yaml' },
    body: config
  };
};
