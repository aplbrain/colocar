import requests
import networkx as nx

class Colocard:

    _url: str

    def __init__(self, url: str) -> None:
        self._url = url.rstrip("/")

    def url(self, suffix: str = "") -> str:
        """
        Construct a FQ URL.

        Arguments:
            suffix (str): The endpoint to access

        Returns:
            str: The fully qualified URL

        """
        return self.url +
