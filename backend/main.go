package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"rsc.io/quote"
)

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	// In the future, you might want to check DB connection status here
	fmt.Fprintln(w, `{"status": "ok"}`)
}

func main() {
	fmt.Println(quote.Hello())
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Default port if not specified
	}

	http.HandleFunc("/api/health", healthCheckHandler)

	log.Printf("Server starting on port %s\n", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Could not start server: %s\n", err)
	}
}
