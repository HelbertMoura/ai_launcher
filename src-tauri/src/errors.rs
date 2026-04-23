use serde::Serialize;
use thiserror::Error;

#[allow(dead_code)]
#[derive(Debug, Error)]
pub enum AppError {
    #[error("command not found: {0}")]
    CommandNotFound(String),
    #[error("timeout after {0}ms")]
    Timeout(u64),
    #[error("process error: {0}")]
    Process(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("http error: {0}")]
    Http(String),
    #[error("invalid config: {0}")]
    InvalidConfig(String),
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

#[allow(dead_code)]
pub type AppResult<T> = Result<T, AppError>;
