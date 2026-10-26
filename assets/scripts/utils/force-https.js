(function forceHttps() {
  const { protocol, hostname, href } = window.location;

  if (protocol === "http:" && hostname !== "localhost" && hostname !== "127.0.0.1") {
    window.location.replace("https:" + href.substring(5));
  }
})();
