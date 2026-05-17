package main

import (
	"net/http"

	"github.com/st-barts/stremio-streamed-addon/handlers"
	"github.com/syumai/workers"
)

func main() {
	http.HandleFunc("/manifest.json", handlers.ManifestHandler)

	workers.Serve(handlers.CorsMiddleware(http.DefaultServeMux)) // use http.DefaultServeMux
}
