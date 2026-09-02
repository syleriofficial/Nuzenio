import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException

from nuzenio_api.schemas import ErrorDetail, ErrorResponse
from nuzenio_api.services import ApplicationError

logger = logging.getLogger(__name__)


def _response(
    *,
    status: int,
    code: str,
    message: str,
    details: list[dict[str, object]] | None = None,
) -> JSONResponse:
    body = ErrorResponse(
        error=ErrorDetail(code=code, message=message, status=status, details=details)
    )
    return JSONResponse(
        status_code=status,
        content=body.model_dump(mode="json", by_alias=True, exclude_none=True),
    )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApplicationError)
    async def application_error(_: Request, error: ApplicationError) -> JSONResponse:
        return _response(status=error.status, code=error.code, message=error.message)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
        details = [
            {
                "location": [str(part) for part in issue["loc"]],
                "message": issue["msg"],
                "type": issue["type"],
            }
            for issue in error.errors()
        ]
        return _response(
            status=422,
            code="validation_error",
            message="The request parameters or body are invalid.",
            details=details,
        )

    @app.exception_handler(HTTPException)
    async def http_error(_: Request, error: HTTPException) -> JSONResponse:
        message = error.detail if isinstance(error.detail, str) else "The request failed."
        return _response(status=error.status_code, code="http_error", message=message)

    @app.exception_handler(SQLAlchemyError)
    async def database_error(_: Request, __: SQLAlchemyError) -> JSONResponse:
        return _response(
            status=503,
            code="database_unavailable",
            message="Reader data is temporarily unavailable. Please retry shortly.",
        )

    @app.exception_handler(Exception)
    async def unexpected_error(_: Request, error: Exception) -> JSONResponse:
        logger.exception("Unhandled Reader API error", exc_info=error)
        return _response(
            status=500,
            code="internal_error",
            message="The request could not be completed. Please retry shortly.",
        )
