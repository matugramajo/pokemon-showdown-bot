module.exports = {
  apps: [{
    name: "pokemon-showdown-bot",
    script: "src/index.js",
    watch: true,
    env: {
      "NODE_ENV": "production",
    },
    max_memory_restart: "200M",
    exp_backoff_restart_delay: 100
  }]
} 