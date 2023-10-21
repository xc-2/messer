function ssht() {
  if [ $# -eq 0 ]; then
    ssh
    return
  fi
  ssh "$@" -t 'tmux new -As0'
}
