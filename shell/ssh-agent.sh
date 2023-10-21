# SSH_AUTH_SOCK=/tmp/ssh-3JPPIrmXkbos/agent.5108; export SSH_AUTH_SOCK;
# SSH_AGENT_PID=5109; export SSH_AGENT_PID;
# echo Agent pid 5109;

ssh_agent_tmp=/tmp/ssh-agent-loader.tmp

if [ -f "$ssh_agent_tmp" ]; then
  echo restore agent
  . $ssh_agent_tmp
  ps -p $SSH_AGENT_PID >/dev/null 2>&1 || SSH_AGENT_PID=
fi

if [ -z "$SSH_AGENT_PID" ]; then
  echo new agent
  ssh-agent > $ssh_agent_tmp
  . $ssh_agent_tmp
  ssh-add
fi
