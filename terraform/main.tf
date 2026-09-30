terraform {
  required_version = ">= 1.5"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.30"
    }
  }
}

# Talks to the local kind cluster via your kubeconfig.
provider "kubernetes" {
  config_path    = "~/.kube/config"
  config_context = var.kube_context
}

# The "prod" sandbox namespace.
resource "kubernetes_namespace" "prod" {
  metadata {
    name = var.namespace
  }
}

resource "kubernetes_deployment" "app" {
  metadata {
    name      = "deploy-sim-app"
    namespace = kubernetes_namespace.prod.metadata[0].name
    labels    = { app = "deploy-sim-app" }
  }
  spec {
    replicas = 2
    selector {
      match_labels = { app = "deploy-sim-app" }
    }
    template {
      metadata {
        labels = { app = "deploy-sim-app" }
      }
      spec {
        container {
          name              = "app"
          image             = var.image
          image_pull_policy = "IfNotPresent"
          port {
            container_port = 8080
          }
          env {
            name  = "APP_VERSION"
            value = var.app_version
          }
          env {
            name  = "GREETING"
            value = var.greeting
          }
          readiness_probe {
            http_get {
              path = "/health"
              port = 8080
            }
            initial_delay_seconds = 2
            period_seconds        = 5
          }
          liveness_probe {
            http_get {
              path = "/health"
              port = 8080
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "app" {
  metadata {
    name      = "deploy-sim-app"
    namespace = kubernetes_namespace.prod.metadata[0].name
  }
  spec {
    selector = { app = "deploy-sim-app" }
    port {
      port        = 80
      target_port = 8080
    }
    type = "ClusterIP"
  }
}