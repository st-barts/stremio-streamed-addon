package main

import (
	"net/http"

	"github.com/syumai/workers"
)

var manifestJson = []byte(`{
	"id": "app.stbarts.stremio-streamed-addon",
	"version": "0.0.1",
	"name": "Stremio Streamed Live Sports Addon",
	"description": "A Stremio addon that serves live streams from streamed",
	"resources": ["catalog", "stream"],
	"types": ["tv"],
	"catalogs": [
		{
			"type": "tv",
			"id": "streamed-live-sports"
		}
	],
	"idPrefixes": ["streamed-live-sports"]
}`)

func main() {
	http.HandleFunc("/manifest.json", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write(manifestJson)
	})

	workers.Serve(nil) // use http.DefaultServeMux
}
