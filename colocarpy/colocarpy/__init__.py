#!/usr/bin/env python3
"""
# colocarpy.Colocard

## Filtering
The `filter` keyword in many of the below functions refers to an arbitrary
filter that the end developer can pass according to the mongoose spec.

## Expansion
The `expand` boolean argument to some of the below functions refers to the
ability to expand one "generation" of references in the database. For example,
`colocarpy.Colocard#get_graphs(expand=True)` will replace the `volume` column
of the returned dataframe with the result of `colocarpy.Colocard#get_volume`,
run on the ID provided in the original column. Note that this may dramatically
increase the runtime of functions with many rows of results.

================================================================================

Copyright 2018 The Johns Hopkins University Applied Physics Laboratory.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

from typing import List

import json

import networkx as nx
from networkx.readwrite import json_graph
import pandas as pd
import requests


__version__ = "0.1.0"


def structure_to_nx(structure: dict) -> nx.Graph:
    """
    Convert a `structure` key to a networkx.Graph.

    Arguments:
        structure (dict): Node-link form dictionary

    Returns:
        nx.Graph

    """
    return json_graph.node_link_graph(structure)

def _unpack_boss_uri(boss_uri: str) -> dict:
    """
    Unpack a Boss URI.

    TODO: Brittle!
    """
    components = boss_uri.split("/")
    collection = components[-3]
    experiment = components[-2]
    channel = components[-1]
    return {
        "type": "bossdb"
        "collection": collection,
        "experiment": experiment,
        "channel": channel,
    }

def unpack_uri(uri: str) -> dict:
    """
    Unpack a URI and return a dictionary of its attributes.

    Arguments:
        uri (str): The URI to unpack

    Returns:
        dict: The unpacked URI

    """
    uri_unpackers = {
        # Currently, only one unpacker
        "bossdb": _unpack_boss_uri
    }
    uri_type = uri.split("://")[0]
    return uri_unpackers[uri_type](uri)


class Colocard:
    """
    colocarpy.Colocard abstracts the interfaces to interact with Colocard.

    See colocarpy/__init__.py for more documentation.

    """

    _url: str

    def __init__(self, url: str) -> None:
        """
        Create a new colocard client.

        Arguments:
            url (str): The qualified location (including protocol) of the server

        """
        self._url = url.rstrip("/")

    def url(self, suffix: str = "") -> str:
        """
        Construct a FQ URL.

        Arguments:
            suffix (str): The endpoint to access

        Returns:
            str: The fully qualified URL

        """
        return self._url + "/" + suffix.lstrip("/")

    def get_graph(self, graph_id: str) -> dict:
        """
        Get a single graph by its ID.

        Arguments:
            graph_id (str): The ID of the graph to retrieve

        Returns:
            dict

        """
        res = requests.get(self.url(f"/graphs/{graph_id}")).json()
        return res

    def get_graphs(self, filter: dict = None, expand=False) -> List:
        """
        Get a list of graphs.

        Automatically converts the `structure` component to a graph object
        in networkx format, which is stored in the `graph` key of the object.

        Arguments:
            filter (dict): See filter documentation.
            expand (bool): See expand documentation.

        Returns:
            pd.DataFrame

        """
        _expandable_columns = {
            "volume": self.get_volume
        }
        res = pd.DataFrame(requests.get(self.url("/graphs/")).json())
        res.set_index("_id", inplace=True)
        res.submitted = pd.to_datetime(res.submitted, unit="ms")
        res['graph'] = res.structure.map(structure_to_nx)

        if expand:
            for col, fn in _expandable_columns.items():
                res[col] = [fn(val) for _, val in res[col].items()]
        return res

    def get_volume(self, volume_id: str) -> dict:
        """
        Get a single volume by its ID.

        Arguments:
            volume_id (str): The ID of the volume to retrieve

        Returns:
            dict

        """
        res = requests.get(self.url(f"/volumes/{volume_id}")).json()
        return res

    def get_volumes(self, filter: dict = None, expand=False):
        """
        Get a list of volumes.

        Arguments:
            filter (dict): See filter documentation.
            expand (bool): See expand documentation.

        Returns:
            pd.DataFrame

        """
        res = pd.DataFrame(requests.get(self.url("/volumes/")).json())
        res.set_index("_id", inplace=True)
        res.uri = res.uri.map(unpack_uri)
        return res

    def get_question(self, question_id: str) -> dict:
        """
        Get a single question by its ID.

        Arguments:
            question_id (str): The ID of the question to retrieve

        Returns:
            dict

        """
        res = requests.get(self.url(f"/questions/{question_id}")).json()
        return res

    def get_next_question(self, assignee: str, namespace: str) -> dict:
        """
        Get the next question for a user.

        First checks for an open question; then sorts by highest to lowest
        priority of unopened questions.

        Arguments:
            assignee (str): The username of the assignee
            namespace (str): The app for which the question was assigned

        Returns:
            dict

        """
        query = json.dumps({
            "assignee": assignee,
            "namespace": namespace,
            "active": True,
            "status": "opened"
        })
        res = requests.get(self.url(f"/questions/?query={query}")).json()
        if len(res):
            return res[0]

        query = json.dumps({
            "assignee": assignee,
            "namespace": namespace,
            "active": True,
            "status": {"$not": "closed"},
        })
        res = sorted(
            requests.get(self.url(f"/questions/?query={query}")).json(),
            reverse=True, key=lambda x: x['priority']
        )
        return res[0]

    def get_questions(self, filter: dict = None, expand=False):
        """
        Get a list of questions.

        Arguments:
            filter (dict): See filter documentation.
            expand (bool): See expand documentation.

        Returns:
            pd.DataFrame

        """
        res = pd.DataFrame(requests.get(self.url("/questions/")).json())
        res.set_index("_id", inplace=True)
        res.created = pd.to_datetime(res.created, unit="ms")
        res.opened = pd.to_datetime(res.opened, unit="ms")
        res.closed = pd.to_datetime(res.closed, unit="ms")
        return res
