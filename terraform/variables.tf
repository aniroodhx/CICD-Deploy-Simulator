variable "kube_context" {
  description = "kubeconfig context for the kind cluster"
  type        = string
  default     = "kind-deploysim"
}

variable "namespace" {
  description = "Namespace acting as the prod sandbox"
  type        = string
  default     = "prod"
}

variable "image" {
  description = "Container image to deploy (tag loaded into kind)"
  type        = string
  default     = "deploy-sim-app:local"
}

variable "app_version" {
  description = "Version string the app reports at /version"
  type        = string
  default     = "local"
}

variable "greeting" {
  description = "GREETING env var; blanking it makes /health fail (Phase 3 scenario)"
  type        = string
  default     = "Hello from the deploy simulator"
}